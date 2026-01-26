// src/worker.ts
import { classifyWorker } from './workers/classify.worker';

console.log('🚀 独立后台 Worker 进程已启动...');

classifyWorker.on('completed', (job) => {
  console.log(`任务 ${job.id} 完成`);
});

classifyWorker.on('failed', (job, err) => {
  console.error(`任务 ${job?.id} 失败: ${err.message}`);
});