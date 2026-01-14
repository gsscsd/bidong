# API使用说明

## 启动服务

```bash
bun run dev
```

## API接口

### 提取用户画像标签

**接口地址：** `POST /api/user-profile/extract-tags`

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
{
  "user_id": "6cef471f-5e2c-4c5a-97a1-d0083062348d",
  "user_introduces": "来自济南，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿",
  "user_sex": "男",
  "user_age": 26
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "{\"hobbies\": [\"篮球\"], \"occupation\": \"外卖员\", \"location\": \"济南\", \"preferences\": [\"肤白貌美大长腿\"], \"personality\": [], \"other\": []}"
}
```

## 使用curl测试

```bash
curl -X POST http://localhost:3000/api/user-profile/extract-tags \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "6cef471f-5e2c-4c5a-97a1-d0083062348d",
    "user_introduces": "来自济南，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿",
    "user_sex": "男",
    "user_age": 26
  }'
```

## 项目结构

```
src/
├── config/
│   ├── config.ts          # 配置服务
│   └── logger.ts          # 日志配置
├── controllers/
│   └── extractUserProfileTagController.ts  # 控制器
├── routes/
│   └── extractUserProfileTagRoutes.ts      # 路由
├── services/
│   └── extractUserProfileTagsService.ts    # 业务逻辑
├── types/
│   └── extractUserProfileTag.ts           # 类型定义
└── index.ts                 # 应用入口
```

## 特性

- ✅ 使用Zod进行参数校验
- ✅ 使用Winston记录日志
- ✅ 模块化开发
- ✅ 错误处理
- ✅ 支持阿里云大模型API调用
- ✅ TypeScript类型安全