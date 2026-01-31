import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';
import { recommendUserProfiles } from '../db/schema';
import { singleRecommendQueue } from '../queue'; // 引入单用户队列实例

export const recommendWorker = new Worker('batch-recommendation', async (job) => {
  console.log(`[Batch] 开始分发全量推荐任务...`);

  // 1. 只查 ID，减少内存占用
  const allUsers = await db.select({ userUuid: recommendUserProfiles.userUuid }).from(recommendUserProfiles);
  
  console.log(`[Batch] 正在分发 ${allUsers.length} 个子任务...`);

  // 2. 批量添加到单用户队列 (BullMQ 的 addBulk 比循环 add 快得多)
  const jobs = allUsers.map(user => ({
    name: 'single-recommend',
    data: { 
      userId: user.userUuid,
      includeAIReason: false // 离线计算通常先不算 AI 理由，省钱省时
    },
    opts: {
      removeOnComplete: true, // 任务完成后自动删除，防止 Redis 爆满
    }
  }));

  // 批量推送到 Redis
  await singleRecommendQueue.addBulk(jobs);

  console.log(`[Batch] ✅ 分发完成，请查看 singleRecommendWorker 的消费进度`);
  return { dispatchedCount: allUsers.length };
}, {
  connection: redisConnection,
});