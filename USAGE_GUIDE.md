# 用户画像标签提取接口使用指南

## 概述

本文档说明了如何使用优化后的用户画像标签提取接口。

## 接口变更

### 1. 扩展的请求字段

`POST /api/v2/extract/extractUserProfileTags` 现在支持以下扩展字段：

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
|--------|------|------|------|--------|
| user_id | string | 否 | 用户唯一标识符 | - |
| user_introduces | string | 是 | 用户自我介绍文本 | - |
| age | number | 否 | 用户年龄 | null |
| education | number | 否 | 教育程度 (1-10) | null |
| education_background | string | 否 | 教育背景描述 | null |
| city | string | 否 | 所在城市 | null |
| height | number | 否 | 身高 | null |
| marital_status | number | 否 | 婚姻状态 (1-5) | null |

### 2. 数据存储逻辑

- 用户信息会自动存储到 `recommendUserProfiles` 表
- AI 返回的标签结果会存储到 `tagsSnapshot` 字段（JSONB 格式）
- 支持新增用户和更新已有用户信息

## 使用示例

### 完整用户资料请求

```json
POST /api/v2/extract/extractUserProfileTags
Content-Type: application/json

{
  "user_id": "user-uuid-123",
  "user_introduces": "我是95后程序员，在上海工作，身高180cm，本科毕业，目前单身，喜欢运动和旅行。希望找到一个性格温柔、有共同语言的女生。",
  "age": 28,
  "education": 5,
  "education_background": "本科",
  "city": "上海",
  "height": 180,
  "marital_status": 1
}
```

### 最小信息请求（容错）

```json
POST /api/v2/extract/extractUserProfileTags
Content-Type: application/json

{
  "user_introduces": "喜欢运动和音乐"
}
```

## 响应格式

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "self_tags": ["程序员", "上海", "喜欢运动", "喜欢旅行"],
    "preference_tags": ["性格温柔", "有共同语言"]
  }
}
```

## 数据库字段说明

### recommendUserProfiles 表字段映射

| API 字段 | 数据库字段 | 说明 |
|----------|------------|------|
| user_id | user_uuid | 用户唯一标识 |
| - | gender | 性别（默认：1-男） |
| age | age | 年龄 |
| height | height | 身高 |
| city | current_city | 当前城市 |
| marital_status | marital_status | 婚姻状态 |
| education | education | 教育程度 |
| - | occupation | 职业（暂时为空） |
| - | annual_income | 年收入（暂时为空） |
| - | tagsSnapshot | AI 返回的标签快照 |

## 字段校验规则

### Zod Schema 定义

```typescript
export const ExtractUserInfoTagSchema = z.object({
  user_id: z.string().optional(),
  user_introduces: z.string().nonempty(),
  age: z.number().nonnegative().optional(),
  education: z.number().int().min(1).max(10).optional(),
  education_background: z.string().optional(),
  city: z.string().optional(),
  height: z.number().nonnegative().optional(),
  marital_status: z.number().int().min(1).max(5).optional(),
});
```

### 教育程度编码 (education)

| 编码 | 教育程度 |
|------|----------|
| 1 | 小学及以下 |
| 2 | 初中 |
| 3 | 高中 |
| 4 | 中专/技校 |
| 5 | 本科 |
| 6 | 硕士 |
| 7 | 博士 |
| 8 | MBA |
| 9 | 其他 |
| 10 | 未知 |

### 婚姻状态编码 (marital_status)

| 编码 | 状态 |
|------|------|
| 1 | 单身 |
| 2 | 未婚有对象 |
| 3 | 已婚 |
| 4 | 离异 |
| 5 | 丧偶 |

## 错误处理

- 如果 `user_id` 不存在，不会影响接口返回结果
- 数据库存储错误会被记录日志，不会抛出异常
- 确保核心标签提取功能始终可用

## 注意事项

1. `user_introduces` 是唯一必填字段
2. 所有扩展字段都是可选的，提供合理的默认值
3. 数据库操作在后台异步执行，不影响响应时间
4. 建议在生产环境中监控数据库操作的错误日志
