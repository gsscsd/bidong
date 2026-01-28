// src/routes/recommend.ts
// app.get('/v1/daily-recommend', async (c) => {
//     const userId = c.req.query('userId');
    
//     // 直接从离线计算好的结果表里拿
//     const record = await db.query.dailyRecommendations.findFirst({
//       where: eq(dailyRecommendations.userId, userId)
//     });
  
//     if (!record) {
//       return c.json({ code: 200, data: [] }); // 或者执行一次兜底的实时召回
//     }
  
//     // 批量获取这些用户的详细信息 (用于展示)
//     const users = await db.select()
//       .from(recommendUserProfiles)
//       .where(inArray(recommendUserProfiles.userUuid, record.recommendedIds));
    
//     // 注意：此处需要按照 record.recommendedIds 的顺序进行重新排序输出
//     const sortedUsers = record.recommendedIds.map(id => users.find(u => u.userUuid === id));
  
//     return c.json({ code: 200, data: sortedUsers });
//   });