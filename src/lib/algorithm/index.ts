import { RecommendWeights } from "./recommend.weights";
import { db } from "../../db";
import {
    recommendUserProfiles,
    userActions,
    userBlacklist,
    tagDefinitions,
    userSettings
} from '../../db/schema';
import { and, eq, gte } from "drizzle-orm";
import { resultForRecall } from "./recall";
import { rerank } from "./rerank";

// --- 类型定义优化 ---
export type UserProfile = typeof recommendUserProfiles.$inferSelect;

export type UserSetting = {
    recommendCount: number;
    preferredAgeMin: number;
    preferredAgeMax: number;
    preferredHeightMin: number;
    preferredHeightMax: number;
    preferredCities: string[];
};


export type Candidate = {
    userId: string;
    recallSources: string[]; // ['vector', 'tag'] 表示两路都召回了
    rawScore: number; // 原始召回分数 (向量距离 或 标签重合度)
    profile: UserProfile;
    isPriority?: boolean;
    tags?: [],
}

/**
 * 主流程优化
 */
export async function generateRecommendationsForUser(userUuid: string): Promise<Candidate[]> {
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

    // 入参为待推荐用户的信息，以及用户的偏好设置，返回候选用户的id，召回来源，召回分数，用户信息
    const candidateUsers = await resultForRecall(userRecord, settings);
    // 重排序，入参为待推荐用户的信息，用户的偏好设置，候选用户的id，召回来源，召回分数，用户信息，返回重排序后的候选用户的id，召回来源，召回分数，用户信息
    const recommendCandidates = await rerank(userUuid, userRecord, settings, candidateUsers);
    return recommendCandidates;
}