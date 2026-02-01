import { pgTable, serial, text, integer, vector, jsonb, timestamp, index, smallint, pgEnum, boolean, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const actionTypeEnum = pgEnum('actionType', ['like', 'dislike', 'match', 'unmatch']);

// --- 1. 标签定义表 ---
export const tagDefinitions = pgTable('tag_definitions', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    level: smallint('level').notNull(),
    parentId: integer('parent_id'), 
    category: text('category'), // 比如：性格、身材、兴趣、社会属性
    isStandard: boolean('is_standard').default(false),
    // --- 新增字段 ---
    embedding: vector('embedding', { dimensions: 1024 }), // 存储语义向量
    usageCount: integer('usage_count').default(0), // 统计热度，辅助初始排序
    status: smallint('status').default(1), // 1: 启用, 0: 弃用, 2: 待审核
}, (table) => {
    return {
        embeddingIdx: index('tag_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    };
});

// --- 1.1 LLM原始抽取的tag定义表 ---
export const tagAliases = pgTable('tag_aliases', {
    id: serial('id').primaryKey(),
    rawName: text('raw_name').unique(), // LLM 抽取的原始字符串，如“爱去健身房”
    standardTagId: integer('standard_tag_id').references(() => tagDefinitions.id), // 映射到“运动达人”
});

// --- 2. 算法推荐主表 (宽表设计) ---
export const recommendUserProfiles = pgTable('recommend_user_profiles', {
    id: serial('id').primaryKey(),

    // --- 1. 关联字段 (必须) ---
    userUuid: text('user_uuid').notNull().unique(), // Java端的公开UUID，作为唯一标识

    // --- 2. 基础过滤特征 (用于 SQL WHERE 过滤) ---
    gender: smallint('gender'),              // 性别：1-男，2-女
    age: smallint('age'),                   // 年龄
    height: smallint('height'),             // 身高
    currentCity: text('current_city'),       // 当前城市
    maritalStatus: smallint('marital_status'), // 婚姻状态
    education: smallint('education'),        // 教育程度
    occupation: text('occupation'),          // 职业
    annualIncome: text('annual_income'),     // 年收入 (如果是区间，建议存文本)

    // 向量数据
    embedding: vector('embedding', { dimensions: 1024 }),

    // 标签 ID 数组
    tagIds: integer('tag_ids').array().notNull().default(sql`'{}'::integer[]`),
    l1TagIds: integer('l1_tag_ids').array().default(sql`'{}'::integer[]`),
    l2TagIds: integer('l2_tag_ids').array().default(sql`'{}'::integer[]`),
    l3TagIds: integer('l3_tag_ids').array().default(sql`'{}'::integer[]`),

    tagsSnapshot: jsonb('tags_snapshot'),
    updateTime: timestamp('update_time').defaultNow(),
    last_login_time: timestamp('last_login_time').defaultNow(), // 用户最近更新时间
    last_active_time: timestamp('last_active_time').defaultNow(),  // 用户最近活跃时间
    is_vip: smallint('is_vip').default(0), // 是否vip
}, (table) => {
    return {
        embeddingIdx: index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
        tagsIdx: index('tags_gin_idx').using('gin', table.l3TagIds),
    };
});

// --- 3. 用户行为表 ---
// 后续在考虑是否要拆分user匹配表
export const userActions = pgTable('user_actions', {
    id: serial('id').primaryKey(),
    fromUserId: text('from_user_id').notNull(),
    toUserId: text('to_user_id').notNull(),
    // 类型: 'like'(右滑), 'dislike'(左滑), 'match'(匹配), 'unmatch'(解绑)
    actionType: actionTypeEnum(),
    createdAt: timestamp('created_at').defaultNow(),
});

// --- 4. 黑名单表 ---
export const userBlacklist = pgTable('user_blacklist', {
    id: serial('id').primaryKey(),
    // 用户id
    userId: text('user_id').notNull(),
    // 被拉黑的用户id
    targetId: text('target_id').notNull(),
});

// --- 5. 离线推荐结果表 ---
export const dailyRecommendations = pgTable('daily_recommendations', {
    id: serial('id').primaryKey(),
    // .unique() 写在列定义上
    userId: text('user_id').notNull().unique(),
    // json格式，待推荐的用户及推荐理由以及排序得分以及权重
    recommendeUsers: jsonb('recommended_users'),
    calculateDate: text('calculate_date').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// --- 6. 标签关联表 ---
export const tagCorrelations = pgTable('tag_correlations', {
    id: serial('id').primaryKey(),
    sourceTagId: integer('source_tag_id').notNull(),
    targetTagId: integer('target_tag_id').notNull(),
    // 语义权重：基于向量相似度计算的初始权重
    semanticWeight: real('semantic_weight'),
    // 业务权重：根据用户点击、共同持有率动态更新的权重（协同过滤）
    coOccurrenceWeight: real('co_occurrence_weight'),
    // 最终综合权重：用于前端排序
    finalWeight: real('final_weight'),
});

// --- 7. 用户设置表 ---
export const userSettings = pgTable('user_settings', {
    id: serial('id').primaryKey(),
    userUuid: text('user_uuid').notNull().unique(),
    // 推荐设置
    recommendCount: smallint('recommend_count').default(20), // 推荐数量，默认20
    // 理想型性别通过自身性别推导：男找女，女找男
    // 理想型年龄范围
    preferredAgeMin: smallint('preferred_age_min').default(20),
    preferredAgeMax: smallint('preferred_age_max').default(45),
    // 理想型身高范围 (单位: cm)
    preferredHeightMin: smallint('preferred_height_min').default(150),
    preferredHeightMax: smallint('preferred_height_max').default(200),
    // 理想型城市 (数组，可为空)
    preferredCities: text('preferred_cities').array().default(sql`'{}'::text[]`),
    updatedAt: timestamp('updated_at').defaultNow(),
});
