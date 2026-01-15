import app from './app';

const server = {
  port: 3999,
  fetch: app.fetch,
};

console.log(`🚀 服务运行在: http://localhost:${server.port}`);

export default server;
