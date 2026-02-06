import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { dailyRecommendations, recommendUserProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateRecommendationReason } from '../lib/algorithm/reason/rec.reason';
import { RECOMMEND_BATCH_KEY } from '../constants/constants';
import { Candidate } from '../lib/algorithm';

interface GenerateReasonJobData {
  userId: string;
  recommendations: Array<Candidate>;
}

export interface ReasonResult {

  userId: string;

  targetUserId: string;
  score: number,

  // 是否高优先匹配
  isPriority: boolean,

  // tags 数组，用于前端展示
  tags: string[],

  // reason 字符串，用于前端展示
  reason: string,

  status: number,

  // 计算批次/日期（用于清理过期数据）
  batchDate: string,

  createdAt: Date,
  updatedAt: Date,

}

// 为推荐列表中的每个用户生成 AI 推荐理由
async function generateReasonsForRecommendations(userId: string, recommendations: Candidate[]) {
  // 获取当前用户信息
  const currentUser = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, userId)).limit(1);
  if (currentUser.length === 0) {
    throw new Error(`用户 ${userId} 不存在`);
  }

  const updatedRecommendations = [];

  // 遍历候选列表，为每个用户生成 AI 推荐理由
  for (const rec of recommendations) {
    try {
      // 获取推荐用户信息
      const targetUser = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, rec.userId)).limit(1);
      if (targetUser.length === 0) {
        console.warn(`[AI Recommend] 推荐用户 ${rec.userId} 不存在，跳过`);
        updatedRecommendations.push({
          ...rec,
          reason: '该用户暂时不可用',
          reasonGenerated: true,
        });
        continue;
      }

      // 生成 AI 推荐理由
      const reason = await generateRecommendationReason(
        currentUser[0],
        targetUser[0],
        rec.tags!,
        rec.rawScore,
        rec.isPriority!
      );

      // 候选列表中每个用户的推荐理由
      const reasonResult: ReasonResult = {
        userId: userId,
        targetUserId: rec.userId,
        score: rec.rawScore,
        isPriority: rec.isPriority!,
        tags: rec.tags!,
        reason: reason,
        status: 1,
        batchDate: RECOMMEND_BATCH_KEY,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // 理论上应该放入到数组中
      // updatedRecommendations.push(reasonResult);

      // 存入到redis序列中
      await redisConnection.rpush(RECOMMEND_BATCH_KEY, JSON.stringify(reasonResult));

      console.log(`[AI Recommend] 为用户 ${userId} 生成推荐理由: ${rec.userId} - ${reason}`);
    } catch (error) {
      console.error(`[AI Recommend] 为用户 ${userId} 生成推荐理由失败 (${rec.userId}):`, error);

      const reasonResult: ReasonResult = {
        userId: userId,
        targetUserId: rec.userId,
        score: rec.rawScore,
        isPriority: rec.isPriority!,
        tags: rec.tags!,
        reason: '推荐理由生成失败，请稍后重试',
        status: 1,
        batchDate: RECOMMEND_BATCH_KEY,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await redisConnection.rpush(RECOMMEND_BATCH_KEY, JSON.stringify(reasonResult));
    }
  }

  return updatedRecommendations;
}

export const aiRecommendReasonWorker = new Worker<GenerateReasonJobData>('ai-recommend-reason', async (job) => {
  console.log(`[Worker: AI Recommend] 开始为用户 ${job.data.userId} 生成推荐理由...`);

  // 获取任务数据
  // 待推荐用户id以及候选推荐列表
  const { userId, recommendations } = job.data;

  // 生成推荐理由，并将所有结果推送到redis序列中
  await generateReasonsForRecommendations(userId, recommendations);

  console.log(`[Worker: AI Recommend] 用户 ${job.data.userId} 推荐理由生成完成`);

  // return { userId, count: updatedRecommendations.length };
}, {
  connection: redisConnection,
  concurrency: 10, // AI 调用较慢，适度并发
});

aiRecommendReasonWorker.on('completed', (job) => {
  console.log(`✅ [aiRecommendReasonWorker] 任务 ${job.id} 已完成`);
});

aiRecommendReasonWorker.on('failed', (job, err) => {
  console.error(`❌ [aiRecommendReasonWorker] 任务 ${job?.id} 失败:`, err.message);
});
