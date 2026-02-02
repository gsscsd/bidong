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
 * 核心逻辑：基于 l3TagIds (具体特征) 的重合度进行召回
 */
export async function tagRecall(
  user: UserProfile,
  settings: UserSetting,
): Promise<UserProfile[]> {
  try {
    const userTagIds = user.l3TagIds;

    // 0. 前置校验：如果用户自己没有打标签，无法通过标签匹配别人
    if (!userTagIds || userTagIds.length === 0) {
      logger.warn(`[Recall Warning]: User ${user.userUuid} has no l3 tags, skip tag recall`);
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
    // 如果设置了意向城市，则只推这些城市；如果没设置（空数组），通常策略是推同城 or 不限
    // 这里演示：如果设置了则过滤，否则不做城市限制（或改为优先同城）
    let cityFilter = undefined;
    if (settings.preferredCities && settings.preferredCities.length > 0) {
      cityFilter = inArray(recommendUserProfiles.currentCity, settings.preferredCities);
    }

    // --- 构造排序字段 (计算重合标签数量) ---
    // 注意：Postgres 标准 SQL 计算数组交集长度比较麻烦，通常使用 intarray 扩展。
    // 这里使用通用 SQL 逻辑：unnest -> intersect -> count
    // 性能注意：对于海量数据，GIN 索引只能加速 WHERE，ORDER BY 计算会较慢。
    // 如果已安装 intarray 扩展，可优化为: sql`icount(${recommendUserProfiles.l3TagIds} & ${userTagIds})`
    const matchCountSql = sql<number>`icount(${recommendUserProfiles.l3TagIds} & ${userTagIds}::integer[])`;    

    const query = db
      .select({
        // 展开所有字段
        ...getTableColumns(recommendUserProfiles),
        // 额外选出匹配分，方便调试或后续混合排序
        matchScore: matchCountSql, 
      })
      .from(recommendUserProfiles)
      .where(
        and(
          // 1. 硬过滤：性别
          eq(recommendUserProfiles.gender, user.gender === 1 ? 2 : 1),
          
          // 2. 硬过滤：年龄范围
          gte(recommendUserProfiles.age, settings.preferredAgeMin),
          lte(recommendUserProfiles.age, settings.preferredAgeMax),
          
          // 3. 硬过滤：身高范围 (补全 Vector Recall 中缺失的逻辑)
          gte(recommendUserProfiles.height, settings.preferredHeightMin),
          lte(recommendUserProfiles.height, settings.preferredHeightMax),

          // 4. 城市过滤 (Optional)
          cityFilter,

          // 5. 核心逻辑：利用 GIN 索引快速筛选出“至少有一个共同标签”的用户
          // arrayOverlaps 对应 PG 的 "&&" 操作符，非常高效
          arrayOverlaps(recommendUserProfiles.l3TagIds, userTagIds),

          // 6. 排除逻辑
          notInBlacklist,
          notInteracted,
          notMatched,
          notSelf
        )
      )
      // 排序策略：优先匹配标签多的，标签数一样则看活跃时间
      .orderBy(desc(matchCountSql), desc(recommendUserProfiles.last_active_time))
      .limit(RecommendWeights.tagRecall?.candidateCount || 50); // 通常标签召回数量可以比向量召回多一点

    const results = await query;
    
    // 由于 select 时为了获取 matchScore 修改了返回结构，这里清理一下只返回 UserProfile
    // 实际业务中，你可能需要这个 matchScore 来做后续的加权排序
    return results.map(({ matchScore, ...profile }) => profile as UserProfile);

  } catch (error) {
    logger.error(`[Tag Recall Error]:`, error);
    return [];
  }
}

