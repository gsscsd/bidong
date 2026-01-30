import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { recommendUserProfiles, dailyRecommendations } from '../db/schema';
import { generateRecommendationsForUser } from '../lib/recommend.algorithm';

export const recommendWorker = new Worker('batch-recommendation', async (job) => {
  console.log(`[Worker: Recommend] 开始执行全量离线推荐计算...`);

  // 获取所有需要推荐的用户
  const allUsers = await db.select().from(recommendUserProfiles);
  console.log(`[Worker: Recommend] 需要为 ${allUsers.length} 个用户生成推荐`);

  const currentDate = new Date().toISOString().split('T')[0];
  let successCount = 0;
  let errorCount = 0;

  for (const user of allUsers) {
    try {
      // 为当前用户生成推荐列表
      const recommendations = await generateRecommendationsForUser(user.userUuid);

      // 构建推荐结果（不包含 AI 推荐理由，由另一个 Worker 生成）
      const recommendedUsers = recommendations.map(r => ({
        userId: r.userId,
        score: r.score,
        isPriority: r.isPriority,
        tags: r.tags,
        reason: '', // AI 推荐理由将由 aiRecommendReason.worker.ts 生成
        reasonGenerated: false, // 标记是否已生成推荐理由
      }));

      // 存入离线表
      await db.insert(dailyRecommendations)
        .values({
          userId: user.userUuid,
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

      successCount++;
      console.log(`[Worker: Recommend] 用户 ${user.userUuid} 推荐完成 (${successCount}/${allUsers.length})`);

      // 触发 AI 推荐理由生成任务
      // 注意：这里将推荐用户列表发送到 ai-recommend-reason 队列
      // await aiRecommendQueue.add('generate-reasons', {
      //   userId: user.userUuid,
      //   recommendations: recommendedUsers,
      // });
    } catch (error) {
      errorCount++;
      console.error(`[Worker: Recommend] 用户 ${user.userUuid} 推荐失败:`, error);
    }
  }

  console.log(`[Worker: Recommend] 全量推荐计算完成，成功 ${successCount}，失败 ${errorCount}`);
  return { successCount, errorCount, totalCount: allUsers.length };
}, {
  connection: redisConnection,
  concurrency: 1, // 离线计算非常耗 DB 性能，建议 1 个 1 个跑
});

recommendWorker.on('completed', (job) => {
  console.log(`✅ [recommendWorker] 任务 ${job.id} 已完成`);
});

recommendWorker.on('failed', (job, err) => {
  console.error(`❌ [recommendWorker] 任务 ${job?.id} 失败:`, err.message);
});