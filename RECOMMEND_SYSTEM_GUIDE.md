# 推荐系统使用指南

## 概述

本推荐系统采用半实时架构，结合了离线批量计算和在线实时查询，为用户提供个性化的匹配推荐。

## 系统架构

### 离线计算层
- **批量推荐 Worker**：每天凌晨 2 点定时执行，为所有用户生成推荐列表
- **AI 推荐理由 Worker**：为推荐的每个用户生成个性化推荐理由
- **单用户推荐 Worker**：为新用户或数据过期的用户触发推荐计算

### 在线服务层
- 提供 REST API 获取推荐列表
- 优先查询离线表，如无数据则触发异步任务

## 数据库表结构

### 核心表
- `recommend_user_profiles`：用户画像宽表（包含基本属性、标签、embedding）
- `user_actions`：用户行为表（like、dislike、match、unmatch）
- `user_blacklist`：黑名单表
- `user_settings`：用户设置表（理想型性别、推荐数量等）
- `daily_recommendations`：离线推荐结果表
- `tag_definitions`：标签定义表
- `tag_correlations`：标签关联表

### 新增字段
- `recommend_user_profiles.target_gender`：理想型性别
- `user_settings`：完整的用户设置表

## 推荐算法流程

1. **硬性过滤**
   - 年龄：±3 岁
   - 性别：严格匹配 targetGender

2. **排除列表构建**
   - 黑名单用户
   - 近 15 天内交互过的用户（左滑右滑）
   - 近 30 天内解绑的用户
   - 当前已匹配的用户

3. **向量化召回**
   - 使用 pgvector + HNSW 索引
   - 召回 Top 100 候选

4. **双向匹配优先级提升**
   - 检索最近 3 天内喜欢过该用户但未处理的用户
   - 额外 +0.5 分

5. **软性过滤评分**
   - 向量相似度（权重 0.35）
   - 标签双向匹配度（权重 0.25）
   - 城市匹配度（权重 0.15）
   - 年龄差（权重 0.10）
   - 身高匹配（权重 0.08）
   - 教育程度（权重 0.05）
   - 职业/收入（权重 0.02）

6. **最终排序**
   - 按综合得分排序
   - 根据用户类型返回 N 个推荐（默认 20 个，VIP 30 个）

7. **AI 推荐理由生成**
   - 为最终推荐的每个用户调用 AI 生成个性化推荐理由

## API 接口

### 1. 获取推荐列表
```http
GET /api/v3/recommendations/:userId
```

**响应示例：**
```json
{
  "code": 200,
  "message": "获取推荐列表成功",
  "data": [
    {
      "userId": "user_123",
      "score": 0.85,
      "isPriority": true,
      "tags": ["热爱运动", "喜欢旅游"],
      "reason": "对方最近喜欢过你，且在运动和旅游方面有共同兴趣",
      "reasonGenerated": true
    }
  ]
}
```

### 2. 触发单用户推荐（管理员）
```http
POST /api/v3/recommendations/trigger/:userId
```

### 3. 触发全量推荐（管理员）
```http
POST /api/v3/recommendations/batch
Content-Type: application/json

{
  "targetDate": "2026-01-30"  // 可选，默认今天
}
```

### 4. 获取推荐统计（管理员）
```http
GET /api/v3/recommendations/stats
```

**响应示例：**
```json
{
  "code": 200,
  "message": "获取推荐统计成功",
  "data": {
    "totalUsers": 1000,
    "todayCoverage": 950,
    "todayCoverageRate": 95,
    "avgRecommendationCount": 18,
    "reasonGeneratedCount": 17100,
    "reasonGeneratedRate": 95
  }
}
```

## 使用步骤

### 1. 数据库迁移
```bash
bun run db:generate
bun run db:migrate
```

### 2. 生成 Mock 数据（开发环境）
```bash
bun run scripts/mock-data.ts
```

### 3. 启动 Worker
```bash
bun run src/worker.ts
```

### 4. 启动 API 服务
```bash
bun run dev
```

### 5. 测试推荐接口
```bash
curl http://localhost:3999/api/v3/recommendations/user_1769776955819_ofciy8e9y
```

### 6. 触发全量推荐（管理员）
```bash
curl -X POST http://localhost:3999/api/v3/recommendations/batch
curl -Method POST http://localhost:3999/api/v3/recommendations/batch
```

## Worker 说明

### recommendWorker（批量推荐）
- **队列名称**：`batch-recommendation`
- **并发度**：1（避免数据库压力过大）
- **触发方式**：定时任务或手动触发
- **功能**：遍历所有用户，执行完整推荐流程

### aiRecommendReasonWorker（AI 推荐理由生成）
- **队列名称**：`ai-recommend-reason`
- **并发度**：3-5（AI 调用较慢，适度并发）
- **触发方式**：由 recommendWorker 调用
- **功能**：为推荐的每个用户生成个性化推荐理由

### singleRecommendWorker（单用户推荐）
- **队列名称**：`single-recommendation`
- **并发度**：5
- **触发方式**：在线 API 调用时触发
- **功能**：为单个用户计算推荐

## 配置说明

### 权重配置
在 `src/lib/recommend.weights.ts` 中调整权重分配：
- `vectorSimilarity`：向量相似度权重
- `tagMatching`：标签匹配度权重
- `cityMatching`：城市匹配度权重
- `ageDifference`：年龄差权重
- `heightMatching`：身高匹配权重
- `educationMatching`：教育程度权重
- `occupationIncome`：职业/收入权重

### 推荐配置
- `ageFilter.maxDiff`：年龄差硬性限制（默认 ±3 岁）
- `vectorRecall.candidateCount`：向量召回候选数量（默认 100）
- `finalRecommendation.defaultCount`：默认推荐数量（默认 20）
- `finalRecommendation.vipCount`：VIP 用户推荐数量（默认 30）

## 监控与日志

### 日志输出
- `[Worker: Recommend]`：批量推荐 Worker 日志
- `[Worker: AI Recommend]`：AI 推荐理由生成 Worker 日志
- `[Worker: Single Recommend]`：单用户推荐 Worker 日志
- `[Recommend API]`：API 接口日志
- `[Recommend]`：推荐算法核心日志

### 监控指标
- 推荐覆盖率（每日）
- 推荐理由生成成功率
- 平均推荐数量
- Worker 任务执行时间

## 故障排查

### 用户无推荐数据
1. 检查用户是否存在
2. 检查用户设置是否配置
3. 检查用户 embedding 是否生成
4. 检查是否有足够的候选用户
5. 检查排除列表是否过大

### AI 推荐理由生成失败
1. 检查 OpenAI API key 是否配置
2. 检查 API 调用次数是否超限
3. 查看 Worker 错误日志
4. 备用推荐理由会自动生成

### 向量化召回慢
1. 检查 HNSW 索引是否创建
2. 检查 embedding 维度是否正确（1024 维）
3. 考虑调整向量召回候选数量

## 性能优化建议

1. **批量推荐 Worker**：
   - 降低并发度（已设置为 1）
   - 在业务低峰期执行（凌晨 2 点）

2. **AI 推荐理由生成**：
   - 批量生成以提高效率
   - 使用缓存避免重复生成
   - 失败后使用备用方案

3. **向量化召回**：
   - 确保 HNSW 索引正常工作
   - 合理设置召回候选数量
   - 定期重建索引

4. **数据库查询**：
   - 为常用查询字段添加索引
   - 使用连接池
   - 批量查询替代循环查询

## 后续优化方向

1. **实时反馈学习**
   - 根据用户行为调整权重
   - A/B 测试不同算法

2. **多样化推荐**
   - 避免推荐结果过于单一
   - 引入随机性和探索

3. **冷启动问题**
   - 为新用户提供热门推荐
   - 基于人口统计学特征推荐

4. **个性化权重**
   - 根据用户偏好动态调整权重
   - 不同用户类型使用不同策略

## 联系方式

如有问题或建议，请联系开发团队。
