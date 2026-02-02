import { and, eq, notInArray, cosineDistance, gte, lte, inArray, sql, notExists } from 'drizzle-orm';
import { db } from '../../../db';
import {
    recommendUserProfiles,
    userActions,
    userBlacklist,
    userSettings,
    tagDefinitions,
} from '../../../db/schema';
import { RecommendWeights, isSameCity } from '../recommend.weights';
import { logger } from '../../../config/logger';
import { UserSetting, UserProfile } from '../';


/**
 * 优化：将硬性过滤（年龄、性别）下推到数据库
 * 使用 NOT EXISTS 替代 notInArray，避免大数组导致 SQL 查询失败
 */
export async function vectorRecall(
    user: UserProfile,
    settings: UserSetting,
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
        // 用户交互记录表中，fromUserId 为推荐用户，toUserId 为用户，actionType 为 like 或 dislike 的记录
        const notInteracted = notExists(
            db.select({ 1: sql`1` })
                .from(userActions)
                .where(and(
                    eq(userActions.fromUserId, user.userUuid),
                    eq(userActions.toUserId, recommendUserProfiles.userUuid)
                ))
        );

        // 3. 排除已匹配过的用户
        // 这里的算法还需要进一步看一下
        // 如果推荐给用户，但是没有消费，算匹配过吗？
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

        const query = db
            .select()
            .from(recommendUserProfiles)
            .where(
                and(
                    // 硬过滤：性别必须相反
                    eq(recommendUserProfiles.gender, user.gender === 1 ? 2 : 1),
                    // 硬过滤：年龄必须在配置范围内
                    gte(recommendUserProfiles.age, settings.preferredAgeMin),
                    lte(recommendUserProfiles.age, settings.preferredAgeMax),
                    
                    // 城市过滤
                    cityFilter,
                    // 排除已交互、黑名单、已匹配用户和自己
                    notInBlacklist,
                    notInteracted,
                    notMatched,
                    notSelf
                )
            )
            // 根据向量距离排序
            .orderBy(cosineDistance(recommendUserProfiles.embedding, user.embedding))
            .limit(RecommendWeights.vectorRecall.candidateCount);

        return await query as UserProfile[];
    } catch (error) {
        logger.error(`[Recall Error]:`, error);
        return [];
    }
}
