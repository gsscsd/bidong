import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { db } from '../db';

export const recommendWorker = new Worker('batch-recommendation', async (job) => {
  console.log(`[Worker: Recommend] 开始执行全量离线推荐计算...`);
  
  // 这里写你之前那个非常复杂的 for 循环逻辑
  // 第一步：过滤... 第二步：召回... 第三步：存入离线表...

//   const allUsers = await db.select().from(recommendUserProfiles);

//   for (const user of allUsers) {
//     // --- 第一步：硬性过滤条件获取 ---
//     const blacklist = await getBlacklist(user.userUuid);
//     const interactedLast15Days = await getInteractedIds(user.userUuid, 15); // 左滑右滑
//     const unmatchedLast30Days = await getUnmatchedIds(user.userUuid, 30); // 30天内解绑
//     const matchedUsers = await getMatchedIds(user.userUuid); // 当前已匹配

//     const excludeIds = [...blacklist, ...interactedLast15Days, ...unmatchedLast30Days, ...matchedUsers, user.userUuid];

//     // --- 第二步：双向匹配策略 (心动回推) ---
//     // 寻找最近 3 天内，有哪些人“喜欢”了我，且我还没处理过
//     const whoLikedMe = await db.select()
//       .from(userActions)
//       .where(and(
//         eq(userActions.toUserId, user.userUuid),
//         eq(userActions.actionType, 'like'),
//         sql`created_at > now() - interval '3 days'`,
//         notInArray(userActions.fromUserId, excludeIds)
//       ));
    
//     const priorityIds = whoLikedMe.map(action => action.fromUserId);

//     // --- 第三步：向量化召回 (召回 100 个) ---
//     const sPool = await db.select({ id: recommendUserProfiles.userUuid })
//       .from(recommendUserProfiles)
//       .where(and(
//         // 硬性过滤：性别、城市、年龄等
//         eq(recommendUserProfiles.gender, user.targetGender),
//         notInArray(recommendUserProfiles.userUuid, excludeIds)
//       ))
//       .orderBy(cosineDistance(recommendUserProfiles.embedding, user.embedding))
//       .limit(100);

//     // --- 第四步：最终排序 (Rerank) ---
//     // 顺序：心动回推(Priority) > 向量相似度
//     const finalIds = [
//       ...priorityIds, // 已经在 excludeIds 里过滤过了
//       ...sPool.map(p => p.id).filter(id => !priorityIds.includes(id))
//     ].slice(0, 10); // 取前 10 个

//     // --- 第五步：存入离线表 ---
//     await db.insert(dailyRecommendations)
//       .values({
//         userId: user.userUuid,
//         recommendedIds: finalIds,
//         calculateDate: new Date().toISOString().split('T')[0]
//       })
//       .onConflictDoUpdate({
//         target: dailyRecommendations.userId,
//         set: { recommendedIds: finalIds, updatedAt: new Date() }
//       });
//   }
  
}, { 
  connection: redisConnection,
  concurrency: 1 // 离线计算非常耗 DB 性能，建议 1 个 1 个跑
});