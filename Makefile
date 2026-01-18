.PHONY: help build run dev stop clean logs

# 默认目标
help:
	@echo "Bidong API Docker 命令"
	@echo ""
	@echo "可用命令:"
	@echo "  build     构建生产镜像"
	@echo "  run       运行生产容器"
	@echo "  dev       启动开发环境"
	@echo "  stop      停止容器"
	@echo "  clean     清理容器和镜像"
	@echo "  logs      查看日志"
	@echo "  test      运行测试"

# 构建生产镜像
build:
	docker build -t bidong-api:latest .

# 构建开发镜像
build-dev:
	docker build -f Dockerfile.dev -t bidong-api:dev .

# 运行生产容器
run:
	@if [ ! -f .env ]; then \
		echo "错误: .env 文件不存在，请先创建并配置环境变量"; \
		exit 1; \
	fi
	docker-compose up -d

# 启动开发环境
dev: build-dev
	docker run -d \
		--name bidong-dev \
		-p 3999:3999 \
		-v $(PWD)/src:/app/src \
		-v $(PWD)/package.json:/app/package.json \
		bidong-api:dev

# 停止容器
stop:
	docker-compose down || true
	docker stop bidong-dev || true

# 清理
clean: stop
	docker system prune -f
	docker rmi bidong-api:latest bidong-api:dev || true

# 查看日志
logs:
	docker-compose logs -f bidong-api || docker logs -f bidong-dev

# 运行测试
test:
	docker run --rm -v $(PWD):/app -w /app oven/bun:1.1-alpine bun test

# 重新部署
deploy: clean build run