# Docker 部署指南

本项目提供了完整的 Docker 部署方案，支持生产环境和开发环境的容器化部署。

## 🐳 Docker 镜像特性

- **多阶段构建**: 优化镜像大小，仅包含运行时必需文件
- **Alpine Linux**: 基于轻量级 Alpine Linux，镜像体积小
- **非 root 用户**: 提升容器安全性
- **健康检查**: 自动监控容器状态
- **日志持久化**: 支持日志文件挂载

## 📦 快速开始

### 方式一：使用 Docker Compose（推荐）

1. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，设置 API 密钥
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

3. **查看服务状态**
   ```bash
   docker-compose ps
   docker-compose logs -f bidong-api
   ```

4. **停止服务**
   ```bash
   docker-compose down
   ```

### 方式二：直接使用 Docker

1. **构建镜像**
   ```bash
   docker build -t bidong-api:latest .
   ```

2. **运行容器**
   ```bash
   docker run -d \
     --name bidong-api \
     -p 3999:3999 \
     -e apiBaseUrl="https://api.siliconflow.cn/v1/chat/completions" \
     -e apiKey="your-api-key-here" \
     -v $(pwd)/logs:/app/logs \
     bidong-api:latest
   ```

## 🔧 开发环境

### 使用开发容器

1. **构建开发镜像**
   ```bash
   docker build -f Dockerfile.dev -t bidong-api:dev .
   ```

2. **启动开发容器**
   ```bash
   docker run -d \
     --name bidong-dev \
     -p 3999:3999 \
     -v $(pwd)/src:/app/src \
     -v $(pwd)/package.json:/app/package.json \
     bidong-api:dev
   ```

开发容器支持热重载，代码修改后会自动重启服务。

## 📋 环境变量配置

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `apiBaseUrl` | 是 | - | AI 服务 API 地址 |
| `apiKey` | 是 | - | AI 服务 API 密钥 |
| `NODE_ENV` | 否 | production | 运行环境 |
| `PORT` | 否 | 3999 | 服务端口 |

## 🔍 健康检查

容器内置健康检查机制：
- **检查间隔**: 30秒
- **超时时间**: 10秒
- **重试次数**: 3次
- **检查端点**: `GET /`

## 📊 日志管理

### 查看应用日志
```bash
# Docker Compose
docker-compose logs -f bidong-api

# Docker 直接运行
docker logs -f bidong-api
```

### 日志文件持久化
项目将日志文件挂载到宿主机的 `./logs` 目录：
- 应用日志: `logs/combined.log`
- 错误日志: `logs/error.log`

## 🚀 生产部署最佳实践

### 1. 使用 Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  bidong-api:
    image: bidong-api:latest
    container_name: bidong-api-prod
    restart: always
    ports:
      - "3999:3999"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - /etc/localtime:/etc/localtime:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3999/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - bidong-network

networks:
  bidong-network:
    driver: bridge
```

### 2. 使用反向代理
推荐使用 Nginx 作为反向代理：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3999;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 资源限制
```yaml
# 在 docker-compose.yml 中添加资源限制
services:
  bidong-api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## 🛠 故障排查

### 容器无法启动
1. 检查环境变量是否正确设置
2. 查看容器日志：`docker logs bidong-api`
3. 确认端口未被占用：`lsof -i :3999`

### API 请求失败
1. 检查 AI 服务 API 密钥是否有效
2. 确认网络连接正常
3. 查看应用日志获取详细错误信息

### 健康检查失败
1. 确认应用正常启动
2. 检查端口配置
3. 验证健康检查端点可访问

## 📈 性能优化

### 镜像优化
- 使用 Alpine Linux 基础镜像
- 多阶段构建减少最终镜像大小
- 移除不必要的开发依赖

### 运行时优化
- 设置适当的资源限制
- 使用健康检查确保服务可用性
- 日志轮转避免磁盘空间不足

## 🔐 安全考虑

- 使用非 root 用户运行容器
- 敏感信息通过环境变量传递
- 定期更新基础镜像
- 限制容器网络访问

## 📝 版本管理

推荐使用语义化版本标记镜像：
```bash
docker build -t bidong-api:1.0.0 .
docker tag bidong-api:1.0.0 bidong-api:latest
```