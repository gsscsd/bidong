# Bidong - 用户画像标签提取API

一个基于Hono框架构建的现代化用户画像分析API服务，通过AI大模型智能提取用户特征标签。

## 🚀 项目特性

- **现代化技术栈**: 使用Bun运行时 + TypeScript + Hono框架
- **AI驱动**: 集成Qwen大模型进行智能用户画像分析
- **类型安全**: 使用Zod进行请求参数验证
- **日志系统**: 完整的日志记录和错误追踪
- **RESTful API**: 标准的REST API设计

## 📋 功能概览

### 用户画像标签提取
根据用户提供的自我介绍信息，智能提取以下维度的标签：
- 兴趣爱好 (hobbies)
- 职业信息 (occupation)
- 地理位置信息 (location)
- 个人偏好 (preferences)
- 性格特征 (personality)
- 其他特征 (other)

## 🛠 技术栈

- **运行时**: Bun
- **框架**: Hono
- **语言**: TypeScript
- **AI模型**: Qwen/Qwen3-8B (通过SiliconFlow API)
- **数据验证**: Zod
- **日志**: Winston

## 📦 安装与运行

### 环境要求
- Node.js 18+ 或 Bun 最新版本
- 支持的平台: macOS, Linux, Windows

### 安装依赖
```bash
bun install
```

### 环境配置
复制环境变量配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置AI服务参数：
```env
apiBaseUrl=https://api.siliconflow.cn/v1/chat/completions
apiKey=sk-your-api-key-here
```

### 启动开发服务器
```bash
bun run dev
```

服务将在 `http://localhost:3999` 启动

## 📚 API文档

### 基础信息
- **Base URL**: `http://localhost:3999`
- **API版本**: v1
- **数据格式**: JSON

### 健康检查
```http
GET /
```

**响应示例:**
```json
{
  "message": "Bidong API is running",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 用户画像标签提取
```http
POST /v1/extractUserProfileTags
```

**请求参数:**
```json
{
  "user_id": "uuid-string",
  "user_introduces": "我是一名程序员，喜欢打篮球，住在北京，喜欢美女",
  "user_sex": "男",
  "user_age": 25
}
```

**响应示例:**
```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "hobbies": ["篮球", "编程"],
    "occupation": "程序员",
    "location": "北京",
    "preferences": ["肤白貌美大长腿"],
    "personality": [],
    "other": []
  }
}
```

**参数说明:**
- `user_id`: 用户唯一标识符 (UUID格式)
- `user_introduces`: 用户自我介绍文本
- `user_sex`: 用户性别 ('男' | '女' | '其他')
- `user_age`: 用户年龄 (1-150之间的整数)

## 🏗 项目结构

```
bidong/
├── src/
│   ├── app.ts                 # 应用主入口
│   ├── index.ts               # 服务器启动文件
│   ├── config/
│   │   └── logger.ts          # 日志配置
│   ├── constants/
│   │   └── prompts.ts         # AI提示词常量
│   ├── lib/
│   │   └── ai-client.ts       # AI服务客户端
│   ├── routes/
│   │   └── extract.route.ts   # 用户画像提取路由
│   ├── services/
│   │   └── tag.service.ts     # 业务逻辑服务
│   └── types/
│       └── user.profile.type.ts # 类型定义
├── logs/                      # 日志文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 开发指南

### 添加新的API端点
1. 在 `src/routes/` 目录下创建新的路由文件
2. 在 `src/services/` 目录下实现业务逻辑
3. 在 `src/types/` 目录下定义相关类型
4. 在 `src/app.ts` 中注册新路由

### 日志查看
- 应用日志: `logs/combined.log`
- 错误日志: `logs/error.log`

### 环境变量
项目使用以下环境变量：
- `apiBaseUrl`: AI服务API地址
- `apiKey`: AI服务API密钥

## 🚨 错误处理

API采用统一的错误响应格式：
```json
{
  "code": 400,
  "message": "参数校验失败",
  "data": null
}
```

常见错误码：
- `400`: 请求参数错误
- `404`: API接口不存在
- `500`: 服务器内部错误

## 📝 许可证

本项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 📞 联系方式

如有问题或建议，请通过Issue联系。