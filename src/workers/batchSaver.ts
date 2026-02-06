import { redisConnection } from '../config/redis';
import { db } from '../db';
import { recommendationQueue } from '../db/schema'; // 确保引入的是 queue 表
import { sql } from 'drizzle-orm';
import { RECOMMEND_BATCH_KEY } from '../constants/constants';
import { ReasonResult } from './recReason.worker';

const BATCH_SIZE = 50; 
const FLUSH_INTERVAL = 2000; 

async function flushBufferToDb() {
  // 1. 定义在 try 外部，方便 catch 使用
  let rawDataList: string[] | null = null;

  try {
    rawDataList = await redisConnection.lpop(RECOMMEND_BATCH_KEY, BATCH_SIZE);

    if (!rawDataList || rawDataList.length === 0) {
      return; 
    }

    console.log(`[Batch Saver] 正在入库 ${rawDataList.length} 条推荐数据...`);

    // 2. 数据转换与映射
    // 我们不需要把 id, createdAt, updatedAt 传进去，数据库会自动处理
    const valuesToInsert = rawDataList.map(itemStr => {
      const item: ReasonResult = JSON.parse(itemStr);
      
      return {
        userId: item.userId,
        targetUserId: item.targetUserId,
        score: item.score,
        isPriority: item.isPriority,
        tags: item.tags,     // Drizzle 会自动处理 string[] 到 text[] 的转换
        reason: item.reason,
        status: item.status,           // 默认为 0 (Pending)
        batchDate: item.batchDate,
        // 注意：这里不要传 item.updatedAt，让数据库决定，或者显式传 new Date()
      };
    });

    // 3. 批量插入 (Bulk Upsert)
    await db.insert(recommendationQueue)
      .values(valuesToInsert)
      .onConflictDoUpdate({
        // 【关键修复】目标必须匹配 schema 中定义的唯一约束: unique_user_target_pair
        target: [recommendationQueue.userId, recommendationQueue.targetUserId],
        
        // 当冲突发生时（该用户已经有了针对这个目标的推荐），更新以下字段：
        set: {
          score: sql`excluded.score`,       // 更新为最新的分数
          reason: sql`excluded.reason`,     // 更新为最新的理由
          tags: sql`excluded.tags`,         // 更新标签
          isPriority: sql`excluded.is_priority`,
          batchDate: sql`excluded.batch_date`,
          updatedAt: new Date(),            // 更新时间戳
          // 可选：如果希望重新推荐给用户看，可以将 status 重置为 0
          // status: 0 
        }
      });
      
    console.log(`[Batch Saver] ✅ 成功入库/更新 ${rawDataList.length} 条`);

  } catch (error) {
    console.error(`[Batch Saver] ❌ 入库失败`, error);
    
    // 补偿机制：如果失败，将数据塞回 Redis 队列头部（或尾部）
    if (rawDataList && rawDataList.length > 0) {
      console.log(`[Batch Saver] ♻️ 触发补偿机制，将数据推回 Redis...`);
      // 使用 unshift (LPUSH) 塞回头部，或者 RPUSH 塞回尾部，视业务需求而定
      // 这里建议 RPUSH 塞回尾部，避免阻塞后续的新数据，或者导致死循环重试
      await redisConnection.rpush(RECOMMEND_BATCH_KEY, ...rawDataList);
    }
  }
}

// 导出启动函数
export function startBatchSaver() {
  // 这里的 setInterval 会阻止 Node 进程退出
  setInterval(flushBufferToDb, FLUSH_INTERVAL);
  console.log('✅ [Batch Saver] 批量入库服务已启动 (2s/次)');
}