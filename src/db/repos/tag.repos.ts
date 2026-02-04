//src/db/repos/tag.repos.ts
import { db } from '..';
import { recommendUserProfiles, tagDefinitions } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { CreateExtractUserProfileTagWithStorageDto } from '../../types/user.profile.type';

interface TagResult {
  self_profile: {
    lifestyle: string[];
    hobbies: string[];
    values: string[];
  };
  partner_preference: {
    lifestyle: string[];
    values: string[];
    hard_constraints: string[];
  };
}

/**
 * 保存用户完整信息和标签快照到 recommendUserProfiles 表
 * 使用 upsert 逻辑，如果 user_uuid 已存在则更新，否则插入
 */
export const upsertUserProfileWithTags = async (
  data: CreateExtractUserProfileTagWithStorageDto,
  tagsSnapshot: any
) => {
  // 准备插入数据
  const insertData = {
    userUuid: data.user_uuid,
    gender: data.gender || null,
    age: data.age || null,
    height: data.height || null,
    currentCity: data.current_city || null,
    maritalStatus: data.marital_status || null,
    education: data.education || null,
    occupation: data.occupation || null,
    annualIncome: data.annual_income || null,
    tagsSnapshot: tagsSnapshot || null,
    // 标签ID字段留空，后续异步处理
    tagIds: [],
    l1TagIds: [],
    l2TagIds: [],
    l3TagIds: [],
  };

  // 先检查用户是否已存在
  const existing = await db
    .select()
    .from(recommendUserProfiles)
    .where(eq(recommendUserProfiles.userUuid, data.user_uuid))
    .limit(1);

  if (existing.length > 0) {
    // 更新现有记录
    await db
      .update(recommendUserProfiles)
      .set(insertData)
      .where(eq(recommendUserProfiles.userUuid, data.user_uuid));
  } else {
    // 插入新记录
    await db.insert(recommendUserProfiles).values(insertData);
  }
};


/**
 * 将self_tags和partner_tags保存到tag_definitions表中
 * 并将对应的tag id存入recommend_user_profiles表的selfTags和partnerTags字段
 */
export const upsertUserTags = async (userUuid: string, tagResult: TagResult) => {
  const selfTagIds: number[] = [];
  const partnerTagIds: number[] = [];

  // 处理 self_profile 标签
  const selfProfile = tagResult.self_profile;
  const selfCategories = [
    { key: 'lifestyle', tags: selfProfile.lifestyle },
    { key: 'hobbies', tags: selfProfile.hobbies },
    { key: 'values', tags: selfProfile.values },
  ];

  for (const { key, tags } of selfCategories) {
    for (const tagName of tags) {
      // 检查标签是否已存在
      const existing = await db
        .select()
        .from(tagDefinitions)
        .where(
          and(
            eq(tagDefinitions.name, tagName),
            eq(tagDefinitions.category, key),
            eq(tagDefinitions.level, 3)
          )
        )
        .limit(1);

      let tagId: number;
      if (existing.length > 0) {
        tagId = existing[0].id;
        // 更新使用计数
        await db
          .update(tagDefinitions)
          .set({
            usageCount: (existing[0].usageCount || 0) + 1,
          })
          .where(eq(tagDefinitions.id, tagId));
      } else {
        // 插入新标签
        const inserted = await db
          .insert(tagDefinitions)
          .values({
            name: tagName,
            level: 3,
            parentId: 0,
            category: key,
            isStandard: false,
            usageCount: 1,
            status: 1,
          })
          .returning();
        tagId = inserted[0].id;
      }
      selfTagIds.push(tagId);
    }
  }

  // 处理 partner_preference 标签
  const partnerPreference = tagResult.partner_preference;
  const partnerCategories = [
    { key: 'lifestyle', tags: partnerPreference.lifestyle },
    { key: 'values', tags: partnerPreference.values },
    { key: 'hard_constraints', tags: partnerPreference.hard_constraints },
  ];

  for (const { key, tags } of partnerCategories) {
    for (const tagName of tags) {
      // 检查标签是否已存在
      const existing = await db
        .select()
        .from(tagDefinitions)
        .where(
          and(
            eq(tagDefinitions.name, tagName),
            eq(tagDefinitions.category, key),
            eq(tagDefinitions.level, 3)
          )
        )
        .limit(1);

      let tagId: number;
      if (existing.length > 0) {
        tagId = existing[0].id;
        // 更新使用计数
        await db
          .update(tagDefinitions)
          .set({
            usageCount: (existing[0].usageCount || 0) + 1,
          })
          .where(eq(tagDefinitions.id, tagId));
      } else {
        // 插入新标签
        const inserted = await db
          .insert(tagDefinitions)
          .values({
            name: tagName,
            level: 3,
            parentId: 0,
            category: key,
            isStandard: false,
            usageCount: 1,
            status: 1,
          })
          .returning();
        tagId = inserted[0].id;
      }
      partnerTagIds.push(tagId);
    }
  }

  // 更新 recommend_user_profiles 表中的 selfTags 和 partnerTags
  await db
    .update(recommendUserProfiles)
    .set({
      selfTags: selfTagIds,
      partnerTags: partnerTagIds,
    })
    .where(eq(recommendUserProfiles.userUuid, userUuid));

  return {
    selfTagIds,
    partnerTagIds,
  };
};

