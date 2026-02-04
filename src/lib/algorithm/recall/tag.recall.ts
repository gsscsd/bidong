import { and, eq, desc, gte, lte, sql, notExists, arrayOverlaps, inArray, or, getTableColumns  } from 'drizzle-orm';
import { db } from '../../../db';
import {
  recommendUserProfiles,
  userActions,
  userBlacklist,
  tagDefinitions,
} from '../../../db/schema';
import { RecommendWeights } from '../recommend.weights';
import { logger } from '../../../config/logger';
import { UserSetting, UserProfile } from '../';

/**
 * 标签召回算法 (Tag-Based Recall)
 * 核心逻辑：
 * 1. 优先召回：用用户的 partnerTags（理想型）匹配其他用户的 selfTags
 * 2. 次优召回：用用户的 selfTags 匹配其他用户的 partnerTags
 */
export async function tagRecall(
  user: UserProfile,
  settings: UserSetting,
): Promise<UserProfile[]> {
  try {
    const userSelfTags = user.selfTags || [];
    const userPartnerTags = user.partnerTags || [];

    // 0. 前置校验：如果用户两个标签都没有，无法通过标签匹配别人
    if (userSelfTags.length === 0 && userPartnerTags.length === 0) {
      logger.warn(`[Recall Warning]: User ${user.userUuid} has no selfTags or partnerTags, skip tag recall`);
      return [];
    }

    // --- 构造过滤条件 (复用逻辑) ---

    // 1. 排除黑名单
    const notInBlacklist = notExists(
      db.select({ 1: sql`1` })
        .from(userBlacklist)
        .where(and(
          eq(userBlacklist.userId, user.userUuid),
          eq(userBlacklist.targetId, recommendUserProfiles.userUuid)
        ))
    );

    // 2. 排除已交互 (Like/Dislike)
    const notInteracted = notExists(
      db.select({ 1: sql`1` })
        .from(userActions)
        .where(and(
          eq(userActions.fromUserId, user.userUuid),
          eq(userActions.toUserId, recommendUserProfiles.userUuid)
        ))
    );

    // 3. 排除已匹配 (Match)
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

    // 5. 城市过滤逻辑
    let cityFilter = undefined;
    if (settings.preferredCities && settings.preferredCities.length > 0) {
      cityFilter = inArray(recommendUserProfiles.currentCity, settings.preferredCities);
    }

    // 基础过滤条件（性别、年龄、身高、城市）
    const baseFilters = and(
      eq(recommendUserProfiles.gender, user.gender === 1 ? 2 : 1),
      gte(recommendUserProfiles.age, settings.preferredAgeMin),
      lte(recommendUserProfiles.age, settings.preferredAgeMax),
      gte(recommendUserProfiles.height, settings.preferredHeightMin),
      lte(recommendUserProfiles.height, settings.preferredHeightMax),
      cityFilter,
      notInBlacklist,
      notInteracted,
      notMatched,
      notSelf
    );

    // 执行两次召回
    const [priorityResults, secondaryResults] = await Promise.all([
      // 优先召回：用用户的 partnerTags 匹配其他用户的 selfTags
      userPartnerTags.length > 0 ? (
        db
          .select({
            ...getTableColumns(recommendUserProfiles),
            matchScore: sql<number>`icount(${recommendUserProfiles.selfTags} & ${userPartnerTags}::integer[])`,
            recallType: sql<string>`'partner_to_self'`
          })
          .from(recommendUserProfiles)
          .where(
            and(
              baseFilters,
              arrayOverlaps(recommendUserProfiles.selfTags, userPartnerTags)
            )
          )
          .orderBy(desc(sql`icount(${recommendUserProfiles.selfTags} & ${userPartnerTags}::integer[])`), desc(recommendUserProfiles.last_active_time))
          .limit(RecommendWeights.tagRecall?.candidateCount || 50)
      ) : Promise.resolve([]),

      // 次优召回：用用户的 selfTags 匹配其他用户的 partnerTags
      userSelfTags.length > 0 ? (
        db
          .select({
            ...getTableColumns(recommendUserProfiles),
            matchScore: sql<number>`icount(${recommendUserProfiles.partnerTags} & ${userSelfTags}::integer[])`,
            recallType: sql<string>`'self_to_partner'`
          })
          .from(recommendUserProfiles)
          .where(
            and(
              baseFilters,
              arrayOverlaps(recommendUserProfiles.partnerTags, userSelfTags)
            )
          )
          .orderBy(desc(sql`icount(${recommendUserProfiles.partnerTags} & ${userSelfTags}::integer[])`), desc(recommendUserProfiles.last_active_time))
          .limit(RecommendWeights.tagRecall?.candidateCount || 50)
      ) : Promise.resolve([])
    ]);

    // 合并并去重
    const userMap = new Map<string, UserProfile>();

    // 优先处理 partner_to_self 的结果（权重更高）
    for (const result of priorityResults) {
      const { matchScore, recallType, ...profile } = result;
      if (!userMap.has(profile.userUuid)) {
        // 给优先召回的结果加权，使其排序更高
        userMap.set(profile.userUuid, profile as UserProfile);
      }
    }

    // 处理 self_to_partner 的结果
    for (const result of secondaryResults) {
      const { matchScore, recallType, ...profile } = result;
      if (!userMap.has(profile.userUuid)) {
        userMap.set(profile.userUuid, profile as UserProfile);
      }
    }

    // 转换为数组并按原始查询顺序返回（priorityResults 在前）
    const finalResults = Array.from(userMap.values());

    logger.info(`[Tag Recall]: User ${user.userUuid} recalled ${finalResults.length} users ` +
      `(priority: ${priorityResults.length}, secondary: ${secondaryResults.length})`);

    return finalResults;

  } catch (error) {
    logger.error(`[Tag Recall Error]:`, error);
    return [];
  }
}

