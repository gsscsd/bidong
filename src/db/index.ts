import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema'; // 导入你刚刚定义的 schema

/**
 * 1. 获取数据库连接字符串
 * 使用 Bun.env 获取环境变量
 */
const connectionString = Bun.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ 致命错误: 环境变量 DATABASE_URL 未定义！");
  console.error("请检查根目录下是否存在 .env 文件，或是否已运行 bun install");
  process.exit(1); // 显式退出并打印错误
}
/**
 * 2. 创建 Postgres 查询执行器
 * 
 * 配置项说明：
 * - prepare: false 
 *   如果你使用的是 Supabase 的连接池（Transaction 模式）或者 PgBouncer，
 *   必须设置为 false，否则会报错。对于普通单机 Postgres，设为 true 性能略好。
 */
const queryClient = postgres(connectionString, { 
  prepare: true,
  // 可以在这里配置连接池大小，4C8G 服务器建议设置在 10-20 左右
  max: 10 
});

/**
 * 3. 初始化 Drizzle 实例
 * 
 * 传入 { schema } 可以让你使用 Drizzle 的关系查询 API (db.query...)
 * 这比单纯的 SQL 拼凑要方便很多。
 */
export const db = drizzle(queryClient, { schema });

// 导出所有的 schema，方便在外部直接使用 db.select().from(schema.users)
export * from './schema';