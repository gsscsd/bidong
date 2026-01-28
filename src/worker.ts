// src/worker.ts
import { tagWorker } from './workers/tag.worker';
import { recommendWorker } from './workers/recommend.worker';

console.log('🚀 所有的后台 Worker 进程已启动...');

// 统一处理事件日志
const workers = [tagWorker, recommendWorker];

workers.forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`✅ [${worker.name}] 任务 ${job.id} 已完成`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [${worker.name}] 任务 ${job?.id} 失败: ${err.message}`);
  });
});