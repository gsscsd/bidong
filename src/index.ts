import app from './app';

const server = {
  port: Bun.env.PORT || 3000,
  fetch: app.fetch,
};

console.log(`🚀 服务运行在: http://localhost:${server.port}`);

export default server;