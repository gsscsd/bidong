// // src/worker.ts
// import { tagWorker } from './workers/tag.worker';
// import { recommendWorker } from './workers/recommend.worker';
// import { aiRecommendReasonWorker } from './workers/aiRecommendReason.worker';
// import { singleRecommendWorker } from './workers/singleRecommend.worker';
// import { logger } from './config/logger';

// logger.log('🚀 所有的后台 Worker 进程已启动...', {
//   output: "result"
// });

// // 统一处理事件日志

// console.log('🚀 所有的后台 Worker 进程已启动...');

// // 统一处理事件日志
// const workers = [tagWorker, recommendWorker, aiRecommendReasonWorker, singleRecommendWorker];

// workers.forEach(worker => {
//   worker.on('completed', (job) => {
//     console.log(`✅ [${worker.name}] 任务 ${job.id} 已完成`);
//   });

//   worker.on('failed', (job, err) => {
//     console.error(`❌ [${worker.name}] 任务 ${job?.id} 失败: ${err.message}`);
//   });
// });

// // --- 新增：防止进程退出 ---
// console.log('🔔 按下 Ctrl+C 可停止 Worker 运行');

// // 使用一个永不结束的定时器保持进程活跃
// setInterval(() => {}, 1000 * 60 * 60); 

// // 处理退出信号，优雅关闭
// process.on('SIGINT', async () => {
//   console.log('\n🛑 正在关闭 Workers...');
//   await Promise.all(workers.map(w => w.close()));
//   process.exit(0);
// });

// src/worker.ts
import { logger } from './config/logger';

async function bootstrap() {
  try {
    console.log('开始加载 Workers...');

    // 动态一个一个加载，看卡在哪个
    console.log('正在加载 tagWorker...');
    const { tagWorker } = await import('./workers/tag.worker');
    
    console.log('正在加载 recommendWorker...');
    const { recommendWorker } = await import('./workers/recommend.worker');
    
    console.log('正在加载 aiRecommendReasonWorker...');
    const { aiRecommendReasonWorker } = await import('./workers/aiRecommendReason.worker');
    
    console.log('正在加载 singleRecommendWorker...');
    const { singleRecommendWorker } = await import('./workers/singleRecommend.worker');

    const workers = [tagWorker, recommendWorker, aiRecommendReasonWorker, singleRecommendWorker];

    workers.forEach(worker => {
      worker.on('completed', (job) => console.log(`✅ [${worker.name}] 任务 ${job.id} 完成`));
      worker.on('failed', (job, err) => console.error(`❌ [${worker.name}] 任务失败: ${err.message}`));
      worker.on('error', err => console.error(`🔥 [${worker.name}] 错误:`, err));
    });

    console.log('🚀 所有的后台 Worker 进程已启动...');
  } catch (err) {
    console.error('❌ 加载 Worker 失败:', err);
  }
}

bootstrap();

// 保持进程
setInterval(() => {}, 1000 * 60);