import { and, eq, notInArray, cosineDistance, gte, inArray, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import {
  recommendUserProfiles,
  userActions,
  userBlacklist,
  userSettings,
  tagDefinitions,
} from '../../db/schema';
import { RecommendWeights, isSameCity } from './recommend.weights';

// 使用 Drizzle 的类型推断来保证类型安全
type RecommendUserProfile = typeof recommendUserProfiles.$inferSelect;
type UserSettingRecord = typeof userSettings.$inferSelect;

export interface UserProfile {
  userUuid: string;
  gender: number;
  age: number;
  height: number;
  currentCity: string;
  education: number;
  occupation: string;
  embedding: number[];
  l3TagIds: number[];
}

export interface UserSetting {
  recommendCount: number;
  preferredAgeMin: number;
  preferredAgeMax: number;
  preferredHeightMin: number;
  preferredHeightMax: number;
  preferredCities: string[];
}

/**
 * 根据用户性别推断理想型性别
 * 中国只有两种性别，异性恋假设：男找女，女找男
 */
export function inferTargetGender(userGender: number): number {
  return userGender === 1 ? 2 : 1;
}

export interface RecommendCandidate {
  userId: string;
  score: number;
  isPriority: boolean; // 是否为心动回推
  tags: string[];
  profile: UserProfile;
}

/**
 * 自定义错误类，用于推荐算法相关的错误
 */
export class RecommendationError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND' | 'INVALID_SETTINGS' | 'DATABASE_ERROR'
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

/**
 * 辅助函数：安全的数组转换
 */
function safeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

/**
 * 辅助函数：安全的数值转换
 */
function safeNumber(value: number | null | undefined, defaultValue: number): number {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
}

/**
 * 获取用户设置
 */
export async function getUserSettings(userUuid: string): Promise<UserSetting> {
  try {
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userUuid, userUuid))
      .limit(1);

    if (settings.length === 0) {
      throw new RecommendationError(
        `User settings not found for user ${userUuid}`,
        'INVALID_SETTINGS'
      );
    }

    const setting = settings[0];

    return {
      recommendCount: safeNumber(setting.recommendCount, RecommendWeights.finalRecommendation.defaultCount),
      preferredAgeMin: safeNumber(setting.preferredAgeMin, 20),
      preferredAgeMax: safeNumber(setting.preferredAgeMax, 45),
      preferredHeightMin: safeNumber(setting.preferredHeightMin, 150),
      preferredHeightMax: safeNumber(setting.preferredHeightMax, 200),
      preferredCities: safeArray(setting.preferredCities),
    };
  } catch (error) {
    if (error instanceof RecommendationError) throw error;
    throw new RecommendationError(
      `Database error while fetching settings for user ${userUuid}: ${error}`,
      'DATABASE_ERROR'
    );
  }
}

/**
 * 获取黑名单
 */
export async function getBlacklist(userUuid: string): Promise<string[]> {
  try {
    const blacklist = await db
      .select({ targetId: userBlacklist.targetId })
      .from(userBlacklist)
      .where(eq(userBlacklist.userId, userUuid));
    return blacklist.map(b => b.targetId);
  } catch (error) {
    console.error(`[Error] Failed to fetch blacklist for user ${userUuid}:`, error);
    return [];
  }
}

/**
 * 获取近期交互用户ID
 */
export async function getInteractedIds(userUuid: string, days: number): Promise<string[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const actions = await db
      .select({ toUserId: userActions.toUserId })
      .from(userActions)
      .where(
        and(
          eq(userActions.fromUserId, userUuid),
          gte(userActions.createdAt, startDate)
        )
      );

    return actions.map(a => a.toUserId);
  } catch (error) {
    console.error(`[Error] Failed to fetch interacted IDs for user ${userUuid}:`, error);
    return [];
  }
}

/**
 * 获取未匹配用户ID（解绑）
 */
export async function getUnmatchedIds(userUuid: string, days: number): Promise<string[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const actions = await db
      .select({ toUserId: userActions.toUserId })
      .from(userActions)
      .where(
        and(
          eq(userActions.fromUserId, userUuid),
          eq(userActions.actionType, 'unmatch'),
          gte(userActions.createdAt, startDate)
        )
      );

    return actions.map(a => a.toUserId);
  } catch (error) {
    console.error(`[Error] Failed to fetch unmatched IDs for user ${userUuid}:`, error);
    return [];
  }
}

/**
 * 获取已匹配用户ID
 */
export async function getMatchedIds(userUuid: string): Promise<string[]> {
  try {
    const [matchedTo, matchedFrom] = await Promise.all([
      db
        .select({ toUserId: userActions.toUserId })
        .from(userActions)
        .where(
          and(
            eq(userActions.fromUserId, userUuid),
            eq(userActions.actionType, 'match')
          )
        ),
      db
        .select({ fromUserId: userActions.fromUserId })
        .from(userActions)
        .where(
          and(
            eq(userActions.toUserId, userUuid),
            eq(userActions.actionType, 'match')
          )
        ),
    ]);

    return [...matchedTo.map(a => a.toUserId), ...matchedFrom.map(a => a.fromUserId)];
  } catch (error) {
    console.error(`[Error] Failed to fetch matched IDs for user ${userUuid}:`, error);
    return [];
  }
}

/**
 * 构建排除列表
 */
export async function buildExcludeList(userUuid: string): Promise<string[]> {
  const [blacklist, interacted, unmatched, matched] = await Promise.all([
    getBlacklist(userUuid),
    getInteractedIds(userUuid, 15),
    getUnmatchedIds(userUuid, 30),
    getMatchedIds(userUuid),
  ]);

  return [...new Set([
    ...blacklist,
    ...interacted,
    ...unmatched,
    ...matched,
    userUuid, // 排除自己
  ])];
}

/**
 * 获取心动回推用户（最近3天内喜欢过我的用户）
 */
export async function getPriorityUsers(userUuid: string, excludeIds: string[]): Promise<string[]> {
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
          notInArray(userActions.fromUserId, excludeIds)
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
export async function getTagNamesByCandidates(candidates: UserProfile[]): Promise<Map<string, string[]>> {
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
 * 向量化召回
 */
export async function vectorRecall(user: UserProfile, excludeIds: string[]): Promise<UserProfile[]> {
  try {
    const candidates = await db
      .select()
      .from(recommendUserProfiles)
      .where(
        and(
          eq(recommendUserProfiles.gender, inferTargetGender(user.gender)),
          notInArray(recommendUserProfiles.userUuid, excludeIds)
        )
      )
      .orderBy(cosineDistance(recommendUserProfiles.embedding, user.embedding))
      .limit(RecommendWeights.vectorRecall.candidateCount);

    return candidates as UserProfile[];
  } catch (error) {
    console.error(`[Error] Vector recall failed for user ${user.userUuid}:`, error);
    return [];
  }
}

/**
 * 计算标签匹配度
 */
function calculateTagScore(
  userSelfTags: number[],
  userTargetTags: number[],
  targetSelfTags: number[],
  targetTargetTags: number[]
): number {
  if (!userSelfTags.length && !userTargetTags.length) return 0;

  // 自身标签与对方理想型重合度
  const selfToTargetIntersection = userSelfTags.filter(tag => targetTargetTags.includes(tag));
  const selfToTargetScore = selfToTargetIntersection.length / Math.max(userSelfTags.length, 1);

  // 理想型标签与对方自身重合度
  const targetToSelfIntersection = userTargetTags.filter(tag => targetSelfTags.includes(tag));
  const targetToSelfScore = targetToSelfIntersection.length / Math.max(userTargetTags.length, 1);

  return (
    selfToTargetScore * RecommendWeights.tagMatching.selfToTarget +
    targetToSelfScore * RecommendWeights.tagMatching.targetToSelf
  ) * RecommendWeights.tagMatching.total;
}

/**
 * 计算城市匹配分数
 */
function calculateCityScore(userCity: string, candidateCity: string): number {
  if (!userCity || !candidateCity) return 0;

  if (isSameCity(userCity, candidateCity)) {
    return RecommendWeights.cityMatching.sameCity;
  } else if (isSameProvince(userCity, candidateCity)) {
    return RecommendWeights.cityMatching.sameProvince;
  } else {
    return RecommendWeights.cityMatching.differentProvince;
  }
}

/**
 * 判断两个城市是否同省
 */
function isSameProvince(city1: string, city2: string): boolean {
  const getProvince = (city: string): string => {
    if (!city) return '';
    const municipalities = ['北京', '上海', '天津', '重庆'];
    for (const m of municipalities) {
      if (city.includes(m)) return m;
    }
    if (city.includes('内蒙古')) return '内蒙古';
    if (city.includes('广西')) return '广西';
    if (city.includes('西藏')) return '西藏';
    if (city.includes('宁夏')) return '宁夏';
    if (city.includes('新疆')) return '新疆';
    return '';
  };
  return getProvince(city1) === getProvince(city2);
}

/**
 * 计算综合得分
 */
function calculateComprehensiveScore(
  user: UserProfile,
  userSettings: UserSetting,
  candidate: UserProfile,
  isPriority: boolean
): number {
  let score = 0;

  // 1. 双向匹配优先级（如果心动回推，加分）
  if (isPriority) {
    score += RecommendWeights.priorityBonus;
  }

  // 2. 向量相似度（基于向量召回的排序，这里使用固定值）
  score += RecommendWeights.vectorSimilarity * 0.5;

  // 3. 标签匹配度（暂时简化处理）
  // score += calculateTagScore(...);

  // 4. 城市匹配度
  score += RecommendWeights.cityMatching.total * calculateCityScore(user.currentCity, candidate.currentCity);

  // 5. 年龄差分数
  const ageDiff = Math.abs(user.age - candidate.age);
  score += RecommendWeights.ageDifference.total * (
    ageDiff <= 1 ? RecommendWeights.ageDifference.diff0to1 :
    ageDiff === 2 ? RecommendWeights.ageDifference.diff2 :
    ageDiff === 3 ? RecommendWeights.ageDifference.diff3 : 0
  );

  // 6. 身高匹配分数
  if (candidate.height >= userSettings.preferredHeightMin && candidate.height <= userSettings.preferredHeightMax) {
    score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.inRange;
  } else {
    const heightDiff = Math.abs(candidate.height - userSettings.preferredHeightMin);
    if (heightDiff <= 3) {
      score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.exceed1to3;
    } else if (heightDiff <= 5) {
      score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.exceed3to5;
    }
  }

  // 7. 教育程度分数
  const eduDiff = Math.abs(user.education - candidate.education);
  score += RecommendWeights.educationMatching.total * (
    eduDiff === 0 ? RecommendWeights.educationMatching.diff0 :
    eduDiff === 1 ? RecommendWeights.educationMatching.diff1 :
    eduDiff === 2 ? RecommendWeights.educationMatching.diff2 :
    eduDiff === 3 ? RecommendWeights.educationMatching.diff3 : 0
  );

  // 8. 职业/收入分数（暂时使用固定值）
  score += RecommendWeights.occupationIncome.total * RecommendWeights.occupationIncome.match;

  return score;
}

/**
 * 为单个用户生成推荐列表
 */
export async function generateRecommendationsForUser(userUuid: string): Promise<RecommendCandidate[]> {
  console.log(`[Recommend] 开始为用户 ${userUuid} 生成推荐列表...`);

  try {
    // 1. 获取用户画像
    const users = await db
      .select()
      .from(recommendUserProfiles)
      .where(eq(recommendUserProfiles.userUuid, userUuid))
      .limit(1);

    if (users.length === 0) {
      console.warn(`[Recommend] 用户 ${userUuid} 不存在`);
      throw new RecommendationError(
        `User profile not found for ${userUuid}`,
        'USER_NOT_FOUND'
      );
    }

    const user = users[0] as UserProfile;

    // 2. 获取用户设置（使用默认值）
    let settings: UserSetting;
    try {
      settings = await getUserSettings(userUuid);
    } catch (error) {
      console.warn(`[Recommend] 用户 ${userUuid} 设置不存在，使用默认值`);
      settings = {
        recommendCount: RecommendWeights.finalRecommendation.defaultCount,
        preferredAgeMin: user.age - RecommendWeights.ageFilter.maxDiff,
        preferredAgeMax: user.age + RecommendWeights.ageFilter.maxDiff,
        preferredHeightMin: user.height - 10,
        preferredHeightMax: user.height + 10,
        preferredCities: [],
      };
    }

    // 3. 并行执行：构建排除列表和获取心动回推用户
    const [excludeIds, priorityIds] = await Promise.all([
      buildExcludeList(userUuid),
      getPriorityUsers(userUuid, [userUuid]), // 先传个临时数组
    ]);

    console.log(`[Recommend] 用户 ${userUuid} 排除列表大小: ${excludeIds.length}, 心动回推数量: ${priorityIds.length}`);

    // 4. 向量化召回
    const vectorCandidates = await vectorRecall(user, excludeIds);
    console.log(`[Recommend] 用户 ${userUuid} 向量召回候选数量: ${vectorCandidates.length}`);

    if (vectorCandidates.length === 0) {
      console.log(`[Recommend] 用户 ${userUuid} 没有可推荐的候选人`);
      return [];
    }

    // 5. 批量获取所有候选人的标签（优化 N+1 查询）
    const tagNamesMap = await getTagNamesByCandidates(vectorCandidates);

    // 6. 构建推荐候选人列表
    const candidates: RecommendCandidate[] = [];

    // 6.1 添加心动回推用户（优先级高）
    for (const priorityId of priorityIds) {
      const priorityUser = vectorCandidates.find(c => c.userUuid === priorityId);
      if (priorityUser) {
        const score = calculateComprehensiveScore(user, settings, priorityUser, true);
        candidates.push({
          userId: priorityUser.userUuid,
          score,
          isPriority: true,
          tags: tagNamesMap.get(priorityUser.userUuid) || [],
          profile: priorityUser,
        });
      }
    }

    // 6.2 添加其他向量召回候选
    for (const candidate of vectorCandidates) {
      // 跳过已经在优先列表中的用户
      if (priorityIds.includes(candidate.userUuid)) continue;

      // 硬性过滤：年龄
      if (candidate.age < user.age - RecommendWeights.ageFilter.maxDiff ||
          candidate.age > user.age + RecommendWeights.ageFilter.maxDiff) {
        continue;
      }

      const score = calculateComprehensiveScore(user, settings, candidate, false);
      candidates.push({
        userId: candidate.userUuid,
        score,
        isPriority: false,
        tags: tagNamesMap.get(candidate.userUuid) || [],
        profile: candidate,
      });
    }

    // 7. 按分数排序
    candidates.sort((a, b) => b.score - a.score);

    // 8. 截断返回
    const finalRecommendations = candidates.slice(0, settings.recommendCount);
    console.log(`[Recommend] 用户 ${userUuid} 最终推荐数量: ${finalRecommendations.length}`);

    return finalRecommendations;
  } catch (error) {
    if (error instanceof RecommendationError) {
      console.error(`[RecommendError] ${error.message} (code: ${error.code})`);
      throw error;
    }
    console.error(`[Error] 推荐生成失败 for ${userUuid}:`, error);
    throw new RecommendationError(
      `Failed to generate recommendations for ${userUuid}: ${error}`,
      'DATABASE_ERROR'
    );
  }
}
