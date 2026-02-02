import { tagRecall } from "./tag.recall";
import { vectorRecall } from "./vector.recall";
import { and, eq, desc, gte } from 'drizzle-orm';
import { db } from '../../../db';
import {
    recommendUserProfiles,
    userActions,
    userBlacklist,
    tagDefinitions,
    userSettings
} from '../../../db/schema';
import { RecommendWeights } from '../recommend.weights';
import { logger } from '../../../config/logger';
import { UserProfile, UserSetting, Candidate } from "../";


async function mergeCandidates(
    vectorList: UserProfile[],
    tagList: UserProfile[]
): Promise<Candidate[]> {
    const candidateMap = new Map<string, Candidate>();

    // 1. 处理向量召回结果
    vectorList.forEach(p => {
        candidateMap.set(p.userUuid, {
            userId: p.userUuid,
            recallSources: ['vector'],
            rawScore: 0, // 暂时不填，精排统一算
            profile: p
        });
    });

    // 2. 处理标签召回结果
    tagList.forEach(p => {
        if (candidateMap.has(p.userUuid)) {
            // 如果这个人已经在向量召回里了，说明匹配度很高
            const existing = candidateMap.get(p.userUuid)!;
            existing.recallSources.push('tag');
        } else {
            candidateMap.set(p.userUuid, {
                userId: p.userUuid,
                recallSources: ['tag'],
                rawScore: 0,
                profile: p
            });
        }
    });

    return Array.from(candidateMap.values());
}

// 主推荐逻辑伪代码
export async function resultForRecall(userRecord: UserProfile, settings: UserSetting): Promise<Candidate[]> {

    // 1. 并行获取基础信息
    // const [userRecord, settingsRecord] = await Promise.all([
    //     db.query.recommendUserProfiles.findFirst({ where: eq(recommendUserProfiles.userUuid, userUuid) }),
    //     db.query.userSettings.findFirst({ where: eq(userSettings.userUuid, userUuid) })
    // ]);

    // if (!userRecord) throw new Error("User not found");

    // // 该用户的召回配置条件
    // const settings: UserSetting = {
    //     // 召回个数
    //     recommendCount: settingsRecord?.recommendCount ?? 20,
    //     // 年龄范围
    //     preferredAgeMin: settingsRecord?.preferredAgeMin ?? userRecord.age! - 5,
    //     preferredAgeMax: settingsRecord?.preferredAgeMax ?? userRecord.age! + 5,
    //     // 身高范围
    //     preferredHeightMin: settingsRecord?.preferredHeightMin ?? 150,
    //     preferredHeightMax: settingsRecord?.preferredHeightMax ?? 200,
    //     // 偏好城市，如果存在的话？
    //     preferredCities: settingsRecord?.preferredCities ?? [],
    // };

    // 并行执行多路召回
    const [vectorCandidates, tagCandidates] = await Promise.all([
        vectorRecall(userRecord, settings),
        // tagRecall(userRecord, settings)
        []
    ]);

    // 去重 (因为一个人可能既像你(向量)，又和你有共同标签)
    const allCandidates = mergeCandidates(vectorCandidates, tagCandidates);

    // 精排 (Rerank)
    // 这里可以用 tagCorrelations 表里的权重，或者简单的加权公式
    // score = (vectorSimilarity * 0.7) + (tagMatchCount * 0.3) + (loginRecency * 0.1)

    return allCandidates;
}
