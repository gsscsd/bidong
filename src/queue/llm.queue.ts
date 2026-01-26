// import { Queue, Worker, Job } from 'bullmq';
// import IORedis from 'ioredis';
// import * as tagService from '../services/tag.service';
// import type { CreateExtractUserProfileTagDto } from '../types/user.profile.type';

// // 1. 连接 Redis
// const connection = new IORedis({ 
//   host: Bun.env.REDIS_HOST || 'localhost', 
//   port: parseInt(Bun.env.REDIS_PORT || '6379'), 
//   maxRetriesPerRequest: null 
// });


// worker.on('completed', (job) => console.log(`任务 ${job.id} 已完成`));
// worker.on('failed', (job, err) => console.error(`任务 ${job?.id} 失败:`, err));


// src/queue/llm.queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// 这是一个单例，大家共用
export const classifyQueue = new Queue('tag-classification', { 
  connection: redisConnection 
});