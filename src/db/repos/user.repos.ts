// src/services/user.repos.ts
import { db } from '..';
import { userBlacklist, userActions, recommendUserProfiles } from '../schema';
import { eq, and, sql, gte, inArray, notInArray } from 'drizzle-orm';
import type { UserProfileData } from '../../types/user.profile.type';

/**
 * 获取用户的黑名单列表
 */
export const getBlacklist = async (userId: string): Promise<string[]> => {
  const result = await db
    .select({ targetId: userBlacklist.targetId })
    .from(userBlacklist)
    .where(eq(userBlacklist.userId, userId));

  return result.map(r => r.targetId);
};

/**
 * 获取最近 N 天内有过划卡行为（左滑/右滑）的用户 ID
 */
export const getInteractedIds = async (userId: string, days: number): Promise<string[]> => {
  const result = await db
    .select({ toUserId: userActions.toUserId })
    .from(userActions)
    .where(
      and(
        eq(userActions.fromUserId, userId),
        inArray(userActions.actionType, ['like', 'dislike']),
        // 使用 Postgres 的时间减法
        gte(userActions.createdAt, sql`now() - interval '${sql.raw(days.toString())} days'`)
      )
    );

  return result.map(r => r.toUserId);
};

/**
 * 获取当前已匹配的用户 ID
 */
export const getMatchedIds = async (userId: string): Promise<string[]> => {
  const result = await db
    .select({ toUserId: userActions.toUserId })
    .from(userActions)
    .where(
      and(
        eq(userActions.fromUserId, userId),
        eq(userActions.actionType, 'match')
      )
    );

  return result.map(r => r.toUserId);
};

/**
 * 存储或更新用户资料到 recommendUserProfiles 表
 */
export const upsertUserProfile = async (profileData: UserProfileData) => {
  try {
    const result = await db
      .insert(recommendUserProfiles)
      .values({
        userUuid: profileData.userUuid,
        gender: profileData.gender,
        age: profileData.age,
        height: profileData.height,
        currentCity: profileData.currentCity,
        maritalStatus: profileData.maritalStatus,
        education: profileData.education,
        occupation: profileData.occupation,
        annualIncome: profileData.annualIncome,
        embedding: profileData.embedding || Array(1024).fill(0), // 默认零向量
        tagIds: profileData.tagIds || [],
        l1TagIds: profileData.l1TagIds || [],
        l2TagIds: profileData.l2TagIds || [],
        l3TagIds: profileData.l3TagIds || [],
        tagsSnapshot: profileData.tagsSnapshot,
      })
      .onConflictDoUpdate({
        target: recommendUserProfiles.userUuid,
        set: {
          gender: profileData.gender,
          age: profileData.age,
          height: profileData.height,
          currentCity: profileData.currentCity,
          maritalStatus: profileData.maritalStatus,
          education: profileData.education,
          occupation: profileData.occupation,
          annualIncome: profileData.annualIncome,
          embedding: profileData.embedding,
          tagIds: profileData.tagIds,
          l1TagIds: profileData.l1TagIds,
          l2TagIds: profileData.l2TagIds,
          l3TagIds: profileData.l3TagIds,
          tagsSnapshot: profileData.tagsSnapshot,
          updateTime: new Date(),
        },
      })
      .returning({ id: recommendUserProfiles.id });

    return result[0];
  } catch (error) {
    console.error('存储用户资料失败:', error);
    throw new Error('存储用户资料到数据库失败');
  }
};

/**
 * 获取用户资料
 */
export const getUserProfile = async (userUuid: string) => {
  try {
    const result = await db
      .select()
      .from(recommendUserProfiles)
      .where(eq(recommendUserProfiles.userUuid, userUuid))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('获取用户资料失败:', error);
    throw new Error('获取用户资料失败');
  }
};
