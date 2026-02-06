// src/worker.ts
import { logger } from './config/logger';

// 1. 引入启动函数 (可以使用静态 import，因为它很轻量)
import { startBatchSaver } from './workers/batchSaver'; 

async function bootstrap() {
  try {
    console.log('开始加载 Workers...');

    // 动态一个一个加载，看卡在哪个
    console.log('正在加载 tagWorker...');
    const { tagWorker } = await import('./workers/tag.worker');
    
    console.log('正在加载 recommendWorker...');
    const { recommendWorker } = await import('./workers/recommend.worker');
    
    console.log('正在加载 aiRecommendReasonWorker...');
    const { aiRecommendReasonWorker } = await import('./workers/recReason.worker');
    
    console.log('正在加载 singleRecommendWorker...');
    const { singleRecommendWorker } = await import('./workers/singleRec.worker');

    const workers = [tagWorker, recommendWorker, aiRecommendReasonWorker, singleRecommendWorker];

    workers.forEach(worker => {
      worker.on('completed', (job) => console.log(`✅ [${worker.name}] 任务 ${job.id} 完成`));
      worker.on('failed', (job, err) => console.error(`❌ [${worker.name}] 任务失败: ${err.message}`));
      worker.on('error', err => console.error(`🔥 [${worker.name}] 错误:`, err));
    });

    // 2. 启动批量入库定时器
    // 这会在后台启动那个 setInterval
    startBatchSaver();

    console.log('🚀 所有的后台 Worker 进程已启动...');
  } catch (err) {
    console.error('❌ 加载 Worker 失败:', err);
  }
}

bootstrap();

// 3. 关于底部的保活代码
// startBatchSaver 内部已经有一个 setInterval 了，Node.js 只要发现有任何 setInterval 在运行，
// 就不会退出进程。
// 所以下面这行其实可以删掉了，但留着作为“兜底”也无伤大雅。
// setInterval(() => {}, 1000 * 60);