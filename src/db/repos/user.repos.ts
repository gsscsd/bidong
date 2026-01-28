// src/services/user.repos.ts
import { db } from '..';
import { userBlacklist, userActions, recommendUserProfiles } from '../schema';
import { eq, and, sql, gte, inArray, notInArray } from 'drizzle-orm';

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
