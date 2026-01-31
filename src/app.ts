// src/app.ts
import { Hono } from 'hono';
import { logger } from './config/logger';
import extractUserProfileTagsV1 from './routes/v1/extract.route';
import extractUserProfileTagsV2 from './routes/v2/extract.route';
import extractUserProfileTagsV3 from './routes/v3/extract.route';
import recommendRouteV3 from './routes/v3/recommend.route';
import { setupDashboard } from './dashboard'; // 引入刚才创建的文件

const app = new Hono();

// 请求日志中间件
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  logger.info(`${c.req.method} ${c.req.url} - ${c.res.status} - ${duration}ms`);
});

// 格式化返回结果
// app.use('*', async (c, next) => {
//   await next();
//   logger.info(`${c.req.method} ${c.req.url} 返回结果为 - ${c.res.status} - ${c.res.json()}`)
//   return c.json({
//     code: 200,
//     message: '返回结果成功',
//     data: c.res.body
//   })
// })

// 健康检查
app.get('/', (c) => {
  return c.json({
    message: 'Bidong API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 用户画像标签路由
app.route('/v1', extractUserProfileTagsV1);
app.route('/v2', extractUserProfileTagsV2);
app.route('/v3', extractUserProfileTagsV3);

// 推荐系统路由
app.route('/api/v3', recommendRouteV3);

// 🔥 挂载 Bull Board 仪表盘
// 访问地址: http://localhost:3999/ui
app.route('/ui', setupDashboard('/ui'));

// 404处理
app.notFound((c) => {
  return c.json({
    code: 404,
    message: 'API接口不存在',
    data: null
  }, 404);
});

// 错误处理
app.onError((err, c) => {
  return c.json({
    code: 500,
    message: err.message || 'Internal Server Error',
    data: null
  }, 500);
});

export default app;
