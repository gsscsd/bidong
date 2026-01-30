import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { dailyRecommendations } from '../db/schema';
import { generateRecommendationsForUser } from '../lib/recommend.algorithm';

interface SingleRecommendJobData {
  userId: string;
  includeAIReason?: boolean; // 是否包含 AI 推荐理由
}

// 为单个用户生成推荐
export const singleRecommendWorker = new Worker<SingleRecommendJobData>('single-recommendation', async (job) => {
  console.log(`[Worker: Single Recommend] 开始为用户 ${job.data.userId} 生成推荐...`);

  const { userId, includeAIReason = true } = job.data;

  // 生成推荐列表
  const recommendations = await generateRecommendationsForUser(userId);

  // 构建推荐结果
  const recommendedUsers = recommendations.map(r => ({
    userId: r.userId,
    score: r.score,
    isPriority: r.isPriority,
    tags: r.tags,
    reason: '', // 暂时为空，后续由 AI Worker 生成
    reasonGenerated: !includeAIReason, // 如果不需要 AI 理由，标记为已生成
  }));

  // 存入数据库
  const currentDate = new Date().toISOString().split('T')[0];
  await db.insert(dailyRecommendations)
    .values({
      userId,
      recommendeUsers: recommendedUsers,
      calculateDate: currentDate,
    })
    .onConflictDoUpdate({
      target: dailyRecommendations.userId,
      set: {
        recommendeUsers: recommendedUsers,
        updatedAt: new Date(),
      },
    });

  console.log(`[Worker: Single Recommend] 用户 ${userId} 推荐生成完成，共 ${recommendedUsers.length} 个`);

  // 如果需要 AI 推荐理由，触发 AI Worker
  if (includeAIReason) {
    // 这里可以添加触发 aiRecommendReasonWorker 的逻辑
    // await aiRecommendQueue.add('generate-reasons', {
    //   userId,
    //   recommendations: recommendedUsers,
    // });
  }

  return { userId, count: recommendedUsers.length };
}, {
  connection: redisConnection,
  concurrency: 5, // 单用户推荐可以适度并发
});

singleRecommendWorker.on('completed', (job) => {
  console.log(`✅ [singleRecommendWorker] 任务 ${job.id} 已完成`);
});

singleRecommendWorker.on('failed', (job, err) => {
  console.error(`❌ [singleRecommendWorker] 任务 ${job?.id} 失败:`, err.message);
});
