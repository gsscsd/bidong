// src/workers/classify.worker.ts
import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import * as tagService from '../services/tag.service';
import type { CreateExtractUserProfileTagDto } from '../types/user.profile.type';

export const classifyWorker = new Worker('tag-classification', async (job) => {
  // 真正调 LLM 的地方
  console.log('正在处理:', job.data.userId);
}, { connection: redisConnection });

export const worker = new Worker('llm-tasks', async (job: Job) => {
  console.log(`正在处理任务: ${job.id}, 数据:`, job.data);
  
  const { userId, user_introduces, user_sex, user_age } = job.data;

  // 调用 LLM 任务
  try {
    console.log(`[LLM] 正在提取用户 ${userId} 的标签...`);
    
    const tagDto: CreateExtractUserProfileTagDto = {
      user_id: userId,
      user_introduces,
      user_sex,
      user_age
    };
    
    const result = await tagService.extractUserProfileTags(tagDto);
    
    console.log(`[LLM] 用户 ${userId} 处理完成！`, result);
    // 可以在这里将结果写入数据库 (Supabase/Milvus)
    
    return result;
  } catch (error) {
    console.error(`任务 ${job.id} 失败:`, error);
    throw error; // 抛出错误会自动触发重试
  }
}, { 
  connection: redisConnection,
  concurrency: 2 // 同时处理的任务数，防止 LLM API 频率超限
});