import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts", // 你的schema文件路径
  dialect: "postgresql", // 可选：mysql、sqlite
  dbCredentials: {
    url: "postgres://username:password@localhost:5432/your_db_name", // 替换为你的数据库连接串
  },
});