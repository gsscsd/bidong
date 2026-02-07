// src/dashboard.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from 'hono/bun';
import { 
  recommendQueue, 
  singleRecommendQueue, 
  aiRecommendQueue,
} from './queue'; // 引入你定义的所有队列

export const setupDashboard = (basePath: string = '/ui') => {
  const serverAdapter = new HonoAdapter(serveStatic);

  // 设置访问路径，例如 /ui
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: [
      // 这里要把你所有的队列都加进去
      new BullMQAdapter(recommendQueue),
      new BullMQAdapter(singleRecommendQueue),
      new BullMQAdapter(aiRecommendQueue),
    ],
    serverAdapter,
  });

  return serverAdapter.registerPlugin();
};