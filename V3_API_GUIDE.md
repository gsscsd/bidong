# Mock 数据接口优化文档

## 概述

本文档描述了 v3 版本的 mock 数据接口，该接口在原有功能基础上扩展了用户信息字段，并实现了数据存储功能。

## 接口版本

- **v1**: 需要部分用户信息（user_id, user_introduces, user_sex, user_age），仅返回标签
- **v2**: 只需要用户描述（user_introduces），仅返回标签
- **v3**: 包含完整用户信息字段，返回标签并将数据存储到数据库

## v3 接口详情

### 接口地址

```
POST /v3/extractUserProfileTags
```

### 请求头

```
Content-Type: application/json
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 | 示例值 |
|------|------|------|------|--------|
| user_uuid | string | 是 | 用户唯一标识，对应数据库 `user_uuid` 字段 | "user_1234567890" |
| user_introduces | string | 是 | 用户自我介绍，用于AI标签抽取 | "我是95后，在北京做程序员..." |
| gender | number | 否 | 性别：1-男，2-女 | 1 |
| age | number | 否 | 年龄（1-120） | 28 |
| height | number | 否 | 身高（100-250） | 175 |
| current_city | string | 否 | 当前城市 | "北京" |
| marital_status | number | 否 | 婚姻状态（枚举值根据业务定义） | 1 |
| education | number | 否 | 教育程度（枚举值根据业务定义） | 4 |
| occupation | string | 否 | 职业 | "程序员" |
| annual_income | string | 否 | 年收入 | "50w左右" |

### 请求示例

**完整用户信息：**
```json
{
  "user_uuid": "user_1234567890",
  "user_introduces": "我是95后，在北京做程序员，年薪50w左右。身高175cm，本科学历，未婚。平时比较宅，喜欢打游戏和撸猫。",
  "gender": 1,
  "age": 28,
  "height": 175,
  "current_city": "北京",
  "marital_status": 1,
  "education": 4,
  "occupation": "程序员",
  "annual_income": "50w左右"
}
```

**部分用户信息（字段缺失）：**
```json
{
  "user_uuid": "user_9876543210",
  "user_introduces": "来自上海，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿。",
  "gender": 1,
  "age": 25,
  "current_city": "上海"
}
```

**最小可用字段：**
```json
{
  "user_uuid": "user_1111111111",
  "user_introduces": "我在杭州做金融，平时爱看电影，希望找一个同样在上海、性格温柔、有共同语言的女生。"
}
```

### 响应格式

**成功响应：**
```json
{
  "code": 200,
  "message": "标签抽取并存储成功",
  "data": {
    "self_tags": ["标签1", "标签2"],
    "preference_tags": ["标签3", "标签4"]
  }
}
```

**失败响应：**
```json
{
  "code": 400,
  "message": "参数校验失败：user_uuid 为必填字段",
  "data": null
}
```

## 数据存储说明

### 存储表结构

数据存储到 `recommend_user_profiles` 表中，字段映射如下：

| 请求字段 | 数据库字段 | 说明 |
|----------|------------|------|
| user_uuid | user_uuid | 用户唯一标识 |
| gender | gender | 性别 |
| age | age | 年龄 |
| height | height | 身高 |
| current_city | current_city | 当前城市 |
| marital_status | marital_status | 婚姻状态 |
| education | education | 教育程度 |
| occupation | occupation | 职业 |
| annual_income | annual_income | 年收入 |
| （AI返回的标签） | tags_snapshot | 标签快照（JSONB格式） |
| （自动填充） | tag_ids | 标签ID数组（初始为空） |
| （自动填充） | l1_tag_ids | 一级标签ID数组（初始为空） |
| （自动填充） | l2_tag_ids | 二级标签ID数组（初始为空） |
| （自动填充） | l3_tag_ids | 三级标签ID数组（初始为空） |

### 标签处理逻辑

1. **AI标签抽取**：基于用户描述（user_introduces）调用大模型抽取标签
2. **标签快照存储**：将AI返回的标签完整存入 `tags_snapshot` 字段（JSONB格式）
3. **标签ID字段留空**：`tag_ids`, `l1_tag_ids`, `l2_tag_ids`, `l3_tag_ids` 初始为空数组，后续异步处理

### 数据更新机制

- 使用 upsert 逻辑：如果 `user_uuid` 已存在则更新，否则插入新记录
- 所有可选字段如果缺失，数据库中存储为 NULL
- 标签ID字段初始为空数组 `[]`

## 字段缺失处理

### 必填字段

以下字段为必填，如果缺失将返回 400 错误：
- `user_uuid`
- `user_introduces`

### 可选字段

以下字段为可选，如果缺失：
- 请求中可以省略
- 数据库中存储为 NULL
- 不影响接口正常工作

### 默认值处理

- `tag_ids`: 默认为空数组 `[]`
- `l1_tag_ids`: 默认为空数组 `[]`
- `l2_tag_ids`: 默认为空数组 `[]`
- `l3_tag_ids`: 默认为空数组 `[]`
- `update_time`: 默认为当前时间（由数据库自动填充）

## 参数校验

Zod 校验规则：

```typescript
ExtractUserProfileTagWithStorageSchema = z.object({
  user_uuid: z.string().nonempty(),
  user_introduces: z.string().nonempty(),
  gender: z.number().int().min(1).max(2).optional(),
  age: z.number().int().min(1).max(120).optional(),
  height: z.number().int().min(100).max(250).optional(),
  current_city: z.string().max(100).optional(),
  marital_status: z.number().int().optional(),
  education: z.number().int().optional(),
  occupation: z.string().max(100).optional(),
  annual_income: z.string().max(100).optional(),
})
```

## 测试

### 运行测试

```bash
# 启动服务
bun run start

# 在另一个终端运行测试
bun run test-v3-api.js
```

### 测试用例

测试文件 `test-v3-api.js` 包含以下测试用例：

1. **完整用户信息**：所有字段都提供
2. **部分用户信息**：只有部分字段，其他字段缺失
3. **最小可用字段**：只有必填字段（user_uuid, user_introduces）
4. **参数校验失败**：缺少必填字段
5. **字段值超出范围**：测试Zod校验

## 后续优化方向

1. **标签ID映射**：异步处理标签，将标签名称映射到 `tag_definitions` 表获取标签ID
2. **标签层级识别**：根据标签定义，将标签分类到 l1, l2, l3 层级
3. **向量化处理**：对用户描述进行向量化，存储到 `embedding` 字段
4. **实时推荐**：基于存储的用户信息和标签，实现实时推荐逻辑

## 相关文件

- 类型定义：`src/types/user.profile.type.ts`
- 服务层：`src/services/tag.service.ts`
- 数据仓库：`src/db/repos/tag.repos.ts`
- 路由定义：`src/routes/v3/extract.route.ts`
- 数据库Schema：`src/db/schema.ts`
- 测试文件：`test-v3-api.js`
