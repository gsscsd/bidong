// src/index.ts 修改如下
import app from './app';

const port = 3999;

console.log(`正在尝试启动...`);

try {
  // 检查 app 是否正确导入
  if (!app) {
    throw new Error('app 实例未定义，请检查 src/app.ts 的导出');
  }

  // 显式调用 Bun.serve
  Bun.serve({
    port: port,
    fetch: app.fetch, 
  });

  console.log(`🚀 服务运行在: http://localhost:${port}`);
} catch (e) {
  console.error("❌ 启动发生错误:");
  console.error(e);
}