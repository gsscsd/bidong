import IORedis from 'ioredis';

// 1. 获取环境变量（建议在 src/config/env.ts 中统一校验，这里演示直接获取）
const REDIS_HOST = Bun.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(Bun.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD || undefined;

/**
 * 2. 创建 Redis 连接配置
 * 
 * 重要提示：
 * 对于 BullMQ，连接实例必须设置 maxRetriesPerRequest: null。
 * 否则，BullMQ 在启动时会抛出错误。
 */
export const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  // 必须设置为 null，否则 BullMQ 会报错
  maxRetriesPerRequest: null,
  // 建议开启，防止 Redis 连不上时整个程序崩溃
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// 监听连接状态（可选，用于 Logger）
redisConnection.on('connect', () => {
  console.log('✅ Redis 已连接成功');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis 连接错误:', err);
});