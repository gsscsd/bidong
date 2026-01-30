import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { dailyRecommendations, recommendUserProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateRecommendationReason } from '../lib/ai.recommendReason';

interface GenerateReasonJobData {
  userId: string;
  recommendations: Array<{
    userId: string;
    score: number;
    isPriority: boolean;
    tags: string[];
  }>;
}

// 为推荐列表中的每个用户生成 AI 推荐理由
async function generateReasonsForRecommendations(userId: string, recommendations: any[]) {
  // 获取当前用户信息
  const currentUser = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, userId)).limit(1);
  if (currentUser.length === 0) {
    throw new Error(`用户 ${userId} 不存在`);
  }

  const updatedRecommendations = [];

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
        rec.tags,
        rec.score,
        rec.isPriority
      );

      updatedRecommendations.push({
        ...rec,
        reason,
        reasonGenerated: true,
      });

      console.log(`[AI Recommend] 为用户 ${userId} 生成推荐理由: ${rec.userId} - ${reason}`);
    } catch (error) {
      console.error(`[AI Recommend] 为用户 ${userId} 生成推荐理由失败 (${rec.userId}):`, error);
      updatedRecommendations.push({
        ...rec,
        reason: '推荐理由生成失败，请稍后重试',
        reasonGenerated: false,
      });
    }
  }

  return updatedRecommendations;
}

export const aiRecommendReasonWorker = new Worker<GenerateReasonJobData>('ai-recommend-reason', async (job) => {
  console.log(`[Worker: AI Recommend] 开始为用户 ${job.data.userId} 生成推荐理由...`);

  const { userId, recommendations } = job.data;

  // 生成推荐理由
  const updatedRecommendations = await generateReasonsForRecommendations(userId, recommendations);

  // 更新数据库
  const currentDate = new Date().toISOString().split('T')[0];
  await db.insert(dailyRecommendations)
    .values({
      userId,
      recommendeUsers: updatedRecommendations,
      calculateDate: currentDate,
    })
    .onConflictDoUpdate({
      target: dailyRecommendations.userId,
      set: {
        recommendeUsers: updatedRecommendations,
        updatedAt: new Date(),
      },
    });

  console.log(`[Worker: AI Recommend] 用户 ${job.data.userId} 推荐理由生成完成`);

  return { userId, count: updatedRecommendations.length };
}, {
  connection: redisConnection,
  concurrency: 3, // AI 调用较慢，适度并发
});

aiRecommendReasonWorker.on('completed', (job) => {
  console.log(`✅ [aiRecommendReasonWorker] 任务 ${job.id} 已完成`);
});

aiRecommendReasonWorker.on('failed', (job, err) => {
  console.error(`❌ [aiRecommendReasonWorker] 任务 ${job?.id} 失败:`, err.message);
});
