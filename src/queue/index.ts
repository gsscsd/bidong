// src/queue/index.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// 1. 标签处理队列 (实时性高, 并发受 LLM API 限制)
export const tagQueue = new Queue('tag-processing', {
  connection: redisConnection
});

// 2. 离线推荐计算队列 (计算密集型, 每天凌晨跑)
export const recommendQueue = new Queue('batch-recommendation', {
  connection: redisConnection
});

// 3. 分类队列 (实时性高, 并发受 LLM API 限制)
export const classifyQueue = new Queue('tag-classification', {
  connection: redisConnection
});

// 4. AI 推荐理由生成队列 (LLM 调用)
export const aiRecommendQueue = new Queue('ai-recommend-reason', {
  connection: redisConnection
});

// 5. 单用户推荐队列 (在线触发)
export const singleRecommendQueue = new Queue('single-recommendation', {
  connection: redisConnection
});
