import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { dailyRecommendations } from '../db/schema';
import { generateRecommendationsForUser } from '../lib/algorithm';
// import { aiRecommendReasonWorker } from './recReason.worker';
import { aiRecommendQueue, recommendQueue } from '../queue'

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
  // const recommendedUsers = recommendations.map(r => ({
  //   userId: r.userId,
  //   score: r.rawScore,
  //   isPriority: r.isPriority,
  //   tags: r.tags,
  //   reason: '', // 暂时为空，后续由 AI Worker 生成
  //   reasonGenerated: !includeAIReason, // 如果不需要 AI 理由，标记为已生成
  // }));


  // 上面已经获取到计算的结果，下面接着调用AI生成理由
  const jobs = recommendations.map(user => ({
    name: 'rec-reason',
    data: { 
      userId: userId,
      recommendations: [user] // 离线计算通常先不算 AI 理由，省钱省时
    },
    opts: {
      removeOnComplete: true, // 任务完成后自动删除，防止 Redis 爆满
    }
  }));

  // 为每个推荐生成 AI 理由
  await aiRecommendQueue.addBulk(jobs);

  console.log(`[Worker: Single Recommend] 用户 ${userId} 推荐生成完成，共 ${recommendations.length} 个`);

}, {
  connection: redisConnection,
  concurrency: 20, // 单用户推荐可以适度并发
});

singleRecommendWorker.on('completed', (job) => {
  console.log(`✅ [singleRecommendWorker] 任务 ${job.id} 已完成`);
});

singleRecommendWorker.on('failed', (job, err) => {
  console.error(`❌ [singleRecommendWorker] 任务 ${job?.id} 失败:`, err.message);
});
