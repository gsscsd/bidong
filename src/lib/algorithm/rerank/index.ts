import { Candidate, UserProfile, UserSetting } from "../recall";
import { RecommendWeights } from "../recommend.weights";
import { db } from "../../../db";
import {
    recommendUserProfiles,
    userActions,
    userBlacklist,
    tagDefinitions,
    userSettings
} from '../../../db/schema';
import { and, eq, gte } from "drizzle-orm";


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
    //   if (user.currentCity === candidate.currentCity) {
    //     score += RecommendWeights.cityMatching.sameCity;
    //   } else if (getProvince(user.currentCity!) === getProvince(candidate.currentCity!)) {
    //     score += RecommendWeights.cityMatching.sameProvince;
    //   }

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
        // 最近3天
        startDate.setDate(startDate.getDate() - 3);

        const actions = await db
            .select({ fromUserId: userActions.fromUserId })
            .from(userActions)
            .where(
                and(
                    eq(userActions.toUserId, userUuid),
                    eq(userActions.actionType, 'like'),
                    gte(userActions.createdAt, startDate),
                )
            );

        return actions.map(a => a.fromUserId);
    } catch (error) {
        console.error(`[Error] Failed to fetch priority users for ${userUuid}:`, error);
        return [];
    }
}



export async function rerank(userUuid: string, candidateUsers: Candidate[]) {

    // 1. 并行获取基础信息
    const [userRecord, settingsRecord] = await Promise.all([
        db.query.recommendUserProfiles.findFirst({ where: eq(recommendUserProfiles.userUuid, userUuid) }),
        db.query.userSettings.findFirst({ where: eq(userSettings.userUuid, userUuid) })
    ]);
    if (!userRecord) throw new Error("User not found");
    // 3. 获取心动回推列表
    const priorityIds = await getPriorityUsers(userUuid, [userUuid]);

    // 该用户的召回配置条件
    const settings: UserSetting = {
        // 召回个数
        recommendCount: settingsRecord?.recommendCount ?? 20,
        // 年龄范围
        preferredAgeMin: settingsRecord?.preferredAgeMin ?? userRecord.age! - 5,
        preferredAgeMax: settingsRecord?.preferredAgeMax ?? userRecord.age! + 5,
        // 身高范围
        preferredHeightMin: settingsRecord?.preferredHeightMin ?? 150,
        preferredHeightMax: settingsRecord?.preferredHeightMax ?? 200,
        // 偏好城市，如果存在的话？
        preferredCities: settingsRecord?.preferredCities ?? [],
    };


    // 5. 评分与排序
    const results = candidateUsers.map(candidate => {
        const isPriority = priorityIds.includes(candidate.userId);
        return {
            userId: candidate.userId,
            score: calculateScore(userRecord as UserProfile, settings, candidate.profile, isPriority),
            isPriority,
            tags: [],
            profile: candidate.profile,
        };
    });

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
}