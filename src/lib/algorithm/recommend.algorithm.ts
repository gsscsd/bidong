import { and, eq, notInArray, cosineDistance, gte, lte, inArray, sql, notExists } from 'drizzle-orm';
import { db } from '../../db';
import {
  recommendUserProfiles,
  userActions,
  userBlacklist,
  userSettings,
  tagDefinitions,
} from '../../db/schema';
import { RecommendWeights, isSameCity } from './recommend.weights';

// --- 类型定义优化 ---
export type UserProfile = typeof recommendUserProfiles.$inferSelect;
export type RecommendCandidate = {
  userId: string;
  score: number;
  isPriority: boolean;
  tags: string[];
  profile: UserProfile;
};
export type UserSetting = {
  recommendCount: number;
  preferredAgeMin: number;
  preferredAgeMax: number;
  preferredHeightMin: number;
  preferredHeightMax: number;
  preferredCities: string[];
};

/**
 * 优化：将硬性过滤（年龄、性别）下推到数据库
 * 使用 NOT EXISTS 替代 notInArray，避免大数组导致 SQL 查询失败
 * @deprecated excludeIds 参数已废弃，现在使用 NOT EXISTS 子查询实现排除逻辑
 */
export async function vectorRecall(
  user: UserProfile,
  settings: UserSetting,
  excludeIds: string[] // 保留此参数以保持向后兼容性，实际不再使用
): Promise<UserProfile[]> {
  try {
    // 如果用户的 embedding 为 null，无法进行向量召回
    if (!user.embedding) {
      console.warn(`[Recall Warning]: User ${user.userUuid} has no embedding, skip vector recall`);
      return [];
    }

    // 使用 NOT EXISTS 替代 notInArray，支持大数据量
    // 1. 排除黑名单中的用户
    const notInBlacklist = notExists(
      db.select({ 1: sql`1` })
        .from(userBlacklist)
        .where(and(
          eq(userBlacklist.userId, user.userUuid),
          eq(userBlacklist.targetId, recommendUserProfiles.userUuid)
        ))
    );

    // 2. 排除已交互过的用户
    const notInteracted = notExists(
      db.select({ 1: sql`1` })
        .from(userActions)
        .where(and(
          eq(userActions.fromUserId, user.userUuid),
          eq(userActions.toUserId, recommendUserProfiles.userUuid)
        ))
    );

    // 3. 排除已匹配过的用户
    const notMatched = notExists(
      db.select({ 1: sql`1` })
        .from(userActions)
        .where(and(
          eq(userActions.toUserId, user.userUuid),
          eq(userActions.actionType, 'match'),
          eq(userActions.fromUserId, recommendUserProfiles.userUuid)
        ))
    );

    // 4. 排除自己
    const notSelf = sql`${recommendUserProfiles.userUuid} != ${user.userUuid}`;

    const query = db
      .select()
      .from(recommendUserProfiles)
      .where(
        and(
          eq(recommendUserProfiles.gender, user.gender === 1 ? 2 : 1),
          // 硬过滤：年龄必须在配置范围内
          gte(recommendUserProfiles.age, settings.preferredAgeMin),
          lte(recommendUserProfiles.age, settings.preferredAgeMax),
          // 排除已交互、黑名单、已匹配用户和自己
          notInBlacklist,
          notInteracted,
          notMatched,
          notSelf
        )
      )
      .orderBy(cosineDistance(recommendUserProfiles.embedding, user.embedding))
      .limit(RecommendWeights.vectorRecall.candidateCount);

    return await query as UserProfile[];
  } catch (error) {
    console.error(`[Recall Error]:`, error);
    return [];
  }
}

/**
 * 改进：更严谨的省份提取逻辑
 */
function getProvince(city: string): string {
  if (!city) return '';
  // 匹配前两个字通常能覆盖 95% 的中国行政区划情况（北京、上海、广东、江苏...）
  // 针对自治区可以做特殊处理
  const specialCases: Record<string, string> = {
    '内蒙古': '内蒙古', '黑龙江': '黑龙江', '新疆': '新疆', '西藏': '西藏', '宁夏': '宁夏', '广西': '广西'
  };
  for (const key in specialCases) {
    if (city.startsWith(key)) return specialCases[key];
  }
  return city.substring(0, 2);
}

/**
 * 综合评分逻辑优化
 */
function calculateScore(
  user: UserProfile,
  settings: UserSetting,
  candidate: UserProfile,
  isPriority: boolean
): number {
  let score = 0;

  // 1. 基础加分
  if (isPriority) score += RecommendWeights.priorityBonus;

  // 2. 城市匹配
  if (user.currentCity === candidate.currentCity) {
    score += RecommendWeights.cityMatching.sameCity;
  } else if (getProvince(user.currentCity!) === getProvince(candidate.currentCity!)) {
    score += RecommendWeights.cityMatching.sameProvince;
  }

  // 3. 年龄匹配 (使用更平滑的衰减函数或权重)
  const ageDiff = Math.abs(user.age! - candidate.age!);
  // 修复：年龄权重映射，0-1岁、2岁、3岁及以上分别使用不同权重
  const ageWeights: Record<number, number> = {
    0: RecommendWeights.ageDifference.diff0to1,
    1: RecommendWeights.ageDifference.diff0to1,
    2: RecommendWeights.ageDifference.diff2,
    3: RecommendWeights.ageDifference.diff3,
  };
  // 限制年龄差最大影响，超过3岁的权重递减但不会为0
  const weightIndex = Math.min(ageDiff, 3);
  score += (ageWeights[weightIndex] || 0) * RecommendWeights.ageDifference.total;

  // 4. 身高匹配
  if (candidate.height! >= settings.preferredHeightMin && candidate.height! <= settings.preferredHeightMax) {
    score += RecommendWeights.heightMatching.inRange * RecommendWeights.heightMatching.total;
  }

  // 5. 教育匹配
  const eduDiff = Math.abs(user.education! - candidate.education!);
  const eduWeights: Record<number, number> = { 0: 1, 1: 0.8, 2: 0.5 };
  score += (eduWeights[eduDiff] || 0) * RecommendWeights.educationMatching.total;

  return score;
}

/**
 * 获取心动回推用户（最近3天内喜欢过我的用户）
 */
async function getPriorityUsers(userUuid: string, excludeIds: string[]): Promise<string[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);

    const actions = await db
      .select({ fromUserId: userActions.fromUserId })
      .from(userActions)
      .where(
        and(
          eq(userActions.toUserId, userUuid),
          eq(userActions.actionType, 'like'),
          gte(userActions.createdAt, startDate),
          excludeIds.length > 0 ? notInArray(userActions.fromUserId, excludeIds) : undefined
        )
      );

    return actions.map(a => a.fromUserId);
  } catch (error) {
    console.error(`[Error] Failed to fetch priority users for ${userUuid}:`, error);
    return [];
  }
}

/**
 * 批量获取标签名称（优化 N+1 查询）
 */
async function getTagNamesByCandidates(candidates: UserProfile[]): Promise<Map<string, string[]>> {
  if (candidates.length === 0) return new Map();

  try {
    // 收集所有需要查询的标签ID
    const allTagIds = new Set<number>();
    const candidateTagMap = new Map<string, number[]>();

    candidates.forEach(candidate => {
      if (candidate.l3TagIds && candidate.l3TagIds.length > 0) {
        candidate.l3TagIds.forEach(tagId => allTagIds.add(tagId));
        candidateTagMap.set(candidate.userUuid, candidate.l3TagIds);
      }
    });

    if (allTagIds.size === 0) {
      return new Map(candidates.map(c => [c.userUuid, []]));
    }

    // 一次性查询所有标签
    const tags = await db
      .select({ id: tagDefinitions.id, name: tagDefinitions.name })
      .from(tagDefinitions)
      .where(inArray(tagDefinitions.id, Array.from(allTagIds)));

    // 构建标签名称映射
    const tagNameMap = new Map<number, string>();
    tags.forEach(tag => tagNameMap.set(tag.id, tag.name));

    // 为每个候选人构建标签名称数组
    const result = new Map<string, string[]>();
    candidates.forEach(candidate => {
      const tagIds = candidateTagMap.get(candidate.userUuid) || [];
      result.set(
        candidate.userUuid,
        tagIds.map(id => tagNameMap.get(id) || '').filter(Boolean)
      );
    });

    return result;
  } catch (error) {
    console.error(`[Error] Failed to fetch tag names:`, error);
    return new Map(candidates.map(c => [c.userUuid, []]));
  }
}

/**
 * 主流程优化
 */
export async function generateRecommendationsForUser(userUuid: string): Promise<RecommendCandidate[]> {
  // 1. 并行获取基础信息
  const [userRecord, settingsRecord] = await Promise.all([
    db.query.recommendUserProfiles.findFirst({ where: eq(recommendUserProfiles.userUuid, userUuid) }),
    db.query.userSettings.findFirst({ where: eq(userSettings.userUuid, userUuid) })
  ]);

  if (!userRecord) throw new Error("User not found");

  const settings: UserSetting = {
    recommendCount: settingsRecord?.recommendCount ?? 20,
    preferredAgeMin: settingsRecord?.preferredAgeMin ?? userRecord.age! - 5,
    preferredAgeMax: settingsRecord?.preferredAgeMax ?? userRecord.age! + 5,
    preferredHeightMin: settingsRecord?.preferredHeightMin ?? 150,
    preferredHeightMax: settingsRecord?.preferredHeightMax ?? 200,
    preferredCities: settingsRecord?.preferredCities ?? [],
  };

  // 2. 向量召回 (带有硬过滤和排除逻辑)
  // 优化：使用 NOT EXISTS 子查询替代大数组，不再需要 buildExcludeList
  const vectorCandidates = await vectorRecall(userRecord as UserProfile, settings, []);

  if (vectorCandidates.length === 0) return [];

  // 3. 获取心动回推列表
  const priorityIds = await getPriorityUsers(userUuid, [userUuid]);

  // 4. 批量获取标签
  const tagNamesMap = await getTagNamesByCandidates(vectorCandidates);

  // 5. 评分与排序
  const results = vectorCandidates.map(candidate => {
    const isPriority = priorityIds.includes(candidate.userUuid);
    return {
      userId: candidate.userUuid,
      score: calculateScore(userRecord as UserProfile, settings, candidate as UserProfile, isPriority),
      isPriority,
      tags: tagNamesMap.get(candidate.userUuid) || [],
      profile: candidate as UserProfile,
    };
  });

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, settings.recommendCount);
}