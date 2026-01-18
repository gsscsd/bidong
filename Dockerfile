# 使用官方 Bun 基础镜像（Alpine Linux 更小）
FROM oven/bun:1.1-alpine AS base

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json bun.lock ./

# 安装依赖阶段
FROM base AS deps
# 仅安装生产依赖，排除开发依赖
RUN bun install --frozen-lockfile --production --clean

# 构建阶段
FROM base AS builder
# 复制所有依赖（包括开发依赖，用于构建）
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建应用为单个可执行文件
RUN bun build src/index.ts --outdir dist --target bun --minify

# 生产运行阶段
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 创建非root用户提升安全性
RUN addgroup --system --gid 1001 bunuser && \
    adduser --system --uid 1001 --ingroup bunuser bunuser

# 复制构建产物和必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 创建日志目录并设置权限
RUN mkdir -p logs && chown -R bunuser:bunuser /app

# 切换到非root用户
USER bunuser

# 暴露端口
EXPOSE 3999

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3999

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3999/ || exit 1

# 启动命令
CMD ["bun", "run", "dist/index.js"]