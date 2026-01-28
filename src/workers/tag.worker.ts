import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import * as tagService from '../services/tag.service';

export const tagWorker = new Worker('tag-processing', async (job) => {
  const { userId, content } = job.data;
  console.log(`[Worker: Tag] 正在提取用户 ${userId} 的标签...`);
  
  // 逻辑实现...
  return await tagService.extractUserProfileTags(job.data);
}, { 
  connection: redisConnection,
  concurrency: 2 // LLM 并发不能太高
});