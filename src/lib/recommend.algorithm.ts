import { and, eq, notInArray, sql, cosineDistance, gte, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  recommendUserProfiles,
  userActions,
  userBlacklist,
  userSettings,
  tagDefinitions,
} from '../db/schema';
import { RecommendWeights } from './recommend.weights';

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

// 获取用户设置
export async function getUserSettings(userUuid: string): Promise<UserSetting | null> {
  const settings = await db.select().from(userSettings).where(eq(userSettings.userUuid, userUuid)).limit(1);
  if (settings.length === 0) return null;

  return {
    recommendCount: settings[0].recommendCount || RecommendWeights.finalRecommendation.defaultCount,
    preferredAgeMin: settings[0].preferredAgeMin || 20,
    preferredAgeMax: settings[0].preferredAgeMax || 45,
    preferredHeightMin: settings[0].preferredHeightMin || 150,
    preferredHeightMax: settings[0].preferredHeightMax || 200,
    preferredCities: settings[0].preferredCities || [],
  };
}

// 获取黑名单
export async function getBlacklist(userUuid: string): Promise<string[]> {
  const blacklist = await db.select().from(userBlacklist).where(eq(userBlacklist.userId, userUuid));
  return blacklist.map(b => b.targetId);
}

// 获取近期交互用户ID
export async function getInteractedIds(userUuid: string, days: number): Promise<string[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const actions = await db.select().from(userActions).where(
    and(
      eq(userActions.fromUserId, userUuid),
      // 2. 直接使用 gte (大于等于) 比较日期对象
      gte(userActions.createdAt, startDate) 
    )
  );
  return [...new Set(actions.map(a => a.toUserId))];
}

// 获取未匹配用户ID（解绑）
export async function getUnmatchedIds(userUuid: string, days: number): Promise<string[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const actions = await db.select().from(userActions).where(
    and(
      eq(userActions.fromUserId, userUuid),
      eq(userActions.actionType, 'unmatch'),
      // sql`created_at > now() - interval '${days} days'`
      gte(userActions.createdAt, startDate)
    )
  );
  return [...new Set(actions.map(a => a.toUserId))];
}

// 获取已匹配用户ID
export async function getMatchedIds(userUuid: string): Promise<string[]> {
  const matchedActions = await db.select().from(userActions).where(
    and(
      eq(userActions.fromUserId, userUuid),
      eq(userActions.actionType, 'match')
    )
  );
  const matchedToIds = matchedActions.map(a => a.toUserId);

  // 同时查找被匹配的用户
  const matchedFromActions = await db.select().from(userActions).where(
    and(
      eq(userActions.toUserId, userUuid),
      eq(userActions.actionType, 'match')
    )
  );
  const matchedFromIds = matchedFromActions.map(a => a.fromUserId);

  return [...new Set([...matchedToIds, ...matchedFromIds])];
}

// 构建排除列表
export async function buildExcludeList(userUuid: string): Promise<string[]> {
  const [blacklist, interacted, unmatched, matched] = await Promise.all([
    getBlacklist(userUuid),
    getInteractedIds(userUuid, 15),
    getUnmatchedIds(userUuid, 30),
    getMatchedIds(userUuid),
  ]);

  return [
    ...blacklist,
    ...interacted,
    ...unmatched,
    ...matched,
    userUuid, // 排除自己
  ];
}

// 获取心动回推用户（最近3天内喜欢过我的用户）
export async function getPriorityUsers(userUuid: string, excludeIds: string[]): Promise<string[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 3);
  const actions = await db.select().from(userActions).where(
    and(
      eq(userActions.toUserId, userUuid),
      eq(userActions.actionType, 'like'),
      // sql`created_at > now() - interval '3 days'`,
      gte(userActions.createdAt, startDate),
      notInArray(userActions.fromUserId, excludeIds)
    )
  );
  return [...new Set(actions.map(a => a.fromUserId))];
}

// 获取标签名称
export async function getTagNames(tagIds: number[]): Promise<string[]> {
  if (!tagIds || tagIds.length === 0) return [];
  const tags = await db.select().from(tagDefinitions).where(
    // sql`id = ANY(${tagIds})`
    inArray(tagDefinitions.id, tagIds) // 使用内置的 inArray
  );
  return tags.map(t => t.name);
}

// 向量化召回
export async function vectorRecall(user: UserProfile, excludeIds: string[]): Promise<UserProfile[]> {
  const candidates = await db.select().from(recommendUserProfiles).where(
    and(
      eq(recommendUserProfiles.gender, inferTargetGender(user.gender)), // 性别匹配：找异性
      notInArray(recommendUserProfiles.userUuid, excludeIds)
    )
  ).orderBy(cosineDistance(recommendUserProfiles.embedding, user.embedding))
    .limit(RecommendWeights.vectorRecall.candidateCount);

  return candidates as UserProfile[];
}

// 计算标签匹配度
function calculateTagScore(userSelfTags: number[], userTargetTags: number[], targetSelfTags: number[], targetTargetTags: number[]): number {
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

// 计算综合得分
async function calculateComprehensiveScore(
  user: UserProfile,
  userSettings: UserSetting,
  candidate: UserProfile,
  isPriority: boolean,
  tagNames: string[]
): Promise<number> {
  let score = 0;

  // 1. 双向匹配优先级（如果心动回推，加分）
  if (isPriority) {
    score += RecommendWeights.priorityBonus;
  }

  // 2. 向量相似度（已经在召回时计算，这里模拟）
  // 实际应该使用 cosineDistance 计算真实距离
  score += RecommendWeights.vectorSimilarity * 0.5; // 假设平均相似度为 0.5

  // 3. 标签匹配度（暂时 mock，实际需要传入对方的 tagIds）
  // score += calculateTagScore(...);

  // 4. 城市匹配度
  // score += RecommendWeights.cityMatching.total * calculateCityScore(user.currentCity, candidate.currentCity);

  // 5. 年龄差分数
  const ageDiff = Math.abs(user.age - candidate.age);
  score += RecommendWeights.ageDifference.total * (
    ageDiff <= 1 ? RecommendWeights.ageDifference.diff0to1 :
    ageDiff === 2 ? RecommendWeights.ageDifference.diff2 :
    ageDiff === 3 ? RecommendWeights.ageDifference.diff3 : 0
  );

  // 6. 身高匹配分数
  const heightDiff = Math.abs(candidate.height - userSettings.preferredHeightMin);
  if (candidate.height >= userSettings.preferredHeightMin && candidate.height <= userSettings.preferredHeightMax) {
    score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.inRange;
  } else if (heightDiff <= 3) {
    score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.exceed1to3;
  } else if (heightDiff <= 5) {
    score += RecommendWeights.heightMatching.total * RecommendWeights.heightMatching.exceed3to5;
  }

  // 7. 教育程度分数
  const eduDiff = Math.abs(user.education - candidate.education);
  score += RecommendWeights.educationMatching.total * (
    eduDiff === 0 ? RecommendWeights.educationMatching.diff0 :
    eduDiff === 1 ? RecommendWeights.educationMatching.diff1 :
    eduDiff === 2 ? RecommendWeights.educationMatching.diff2 :
    eduDiff === 3 ? RecommendWeights.educationMatching.diff3 : 0
  );

  // 8. 职业/收入分数（暂时 mock）
  score += RecommendWeights.occupationIncome.total * RecommendWeights.occupationIncome.match;

  return score;
}

// 为单个用户生成推荐列表
export async function generateRecommendationsForUser(userUuid: string): Promise<RecommendCandidate[]> {
  console.log(`[Recommend] 开始为用户 ${userUuid} 生成推荐列表...`);

  // 1. 获取用户画像
  const users = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, userUuid)).limit(1);
  if (users.length === 0) {
    console.warn(`[Recommend] 用户 ${userUuid} 不存在`);
    return [];
  }
  const user = users[0] as UserProfile;

  // 2. 获取用户设置
  let settings = await getUserSettings(userUuid);
  if (!settings) {
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

  // 3. 构建排除列表
  const excludeIds = await buildExcludeList(userUuid);
  console.log(`[Recommend] 用户 ${userUuid} 排除列表大小: ${excludeIds.length}`);

  // 4. 获取心动回推用户
  const priorityIds = await getPriorityUsers(userUuid, excludeIds);
  console.log(`[Recommend] 用户 ${userUuid} 心动回推数量: ${priorityIds.length}`);

  // 5. 向量化召回
  const vectorCandidates = await vectorRecall(user, excludeIds);
  console.log(`[Recommend] 用户 ${userUuid} 向量召回候选数量: ${vectorCandidates.length}`);

  // 6. 构建推荐候选人列表
  const candidates: RecommendCandidate[] = [];

  // 6.1 添加心动回推用户（优先级高）
  for (const priorityId of priorityIds) {
    const priorityUser = vectorCandidates.find(c => c.userUuid === priorityId);
    if (priorityUser) {
      const tagNames = await getTagNames(priorityUser.l3TagIds);
      const score = await calculateComprehensiveScore(user, settings, priorityUser, true, tagNames);
      candidates.push({
        userId: priorityUser.userUuid,
        score,
        isPriority: true,
        tags: tagNames,
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

    const tagNames = await getTagNames(candidate.l3TagIds);
    const score = await calculateComprehensiveScore(user, settings, candidate, false, tagNames);
    candidates.push({
      userId: candidate.userUuid,
      score,
      isPriority: false,
      tags: tagNames,
      profile: candidate,
    });
  }

  // 7. 按分数排序
  candidates.sort((a, b) => b.score - a.score);

  // 8. 截断返回
  const finalRecommendations = candidates.slice(0, settings.recommendCount);
  console.log(`[Recommend] 用户 ${userUuid} 最终推荐数量: ${finalRecommendations.length}`);

  return finalRecommendations;
}
