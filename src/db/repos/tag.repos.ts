//src/db/repos/tag.repos.ts
import { db } from '..';
import { recommendUserProfiles } from '../schema';
import { eq } from 'drizzle-orm';
import type { CreateExtractUserProfileTagWithStorageDto } from '../../types/user.profile.type';

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


