import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../../db';
import { dailyRecommendations, recommendUserProfiles } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { recommendQueue, singleRecommendQueue, aiRecommendQueue } from '../../queue';
import { logger } from '../../config/logger';

const router = new Hono();

/**
 * v3 接口：获取推荐列表
 * GET /api/v3/recommendations/:userId
 */
router.get('/recommendations/:userId', async (c) => {
  const userId = c.req.param('userId');

  try {
    // 1. 检查用户是否存在
    const user = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, userId)).limit(1);
    if (user.length === 0) {
      return c.json({
        code: 404,
        message: '用户不存在',
        data: null
      }, 404);
    }

    // 2. 查询离线推荐结果
    const today = new Date().toISOString().split('T')[0];
    const recommendations = await db.select().from(dailyRecommendations).where(eq(dailyRecommendations.userId, userId)).limit(1);

    if (recommendations.length === 0 || recommendations[0].calculateDate !== today) {
      // 无今日推荐数据，触发异步任务
      logger.info(`[Recommend API] 用户 ${userId} 今日推荐数据不存在，触发异步任务`);

      // 添加到单用户推荐队列
      await singleRecommendQueue.add('single-recommend', {
        userId,
        includeAIReason: true,
      });

      return c.json({
        code: 200,
        message: '推荐正在计算中，请稍后重试',
        data: []
      });
    }

    // 3. 返回推荐列表
    const recommendData = recommendations[0].recommendeUsers || [];

    // 如果推荐理由未生成，触发 AI 任务
    const hasUnfinishedReasons = recommendData.some((r: any) => !r.reasonGenerated);
    if (hasUnfinishedReasons) {
      logger.info(`[Recommend API] 用户 ${userId} 推荐理由未完成，触发 AI 任务`);

      await aiRecommendQueue.add('generate-reasons', {
        userId,
        recommendations: recommendData,
      });
    }

    return c.json({
      code: 200,
      message: '获取推荐列表成功',
      data: recommendData,
    });
  } catch (error) {
    logger.error('[Recommend API] 获取推荐列表失败', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json({
      code: 500,
      message: '获取推荐列表失败',
      data: null
    }, 500);
  }
});

/**
 * v3 接口：触发单用户推荐（管理员接口）
 * POST /api/v3/recommendations/trigger/:userId
 */
router.post('/recommendations/trigger/:userId', async (c) => {
  const userId = c.req.param('userId');

  try {
    // 检查用户是否存在
    const user = await db.select().from(recommendUserProfiles).where(eq(recommendUserProfiles.userUuid, userId)).limit(1);
    if (user.length === 0) {
      return c.json({
        code: 404,
        message: '用户不存在',
        data: null
      }, 404);
    }

    // 添加到单用户推荐队列
    await singleRecommendQueue.add('single-recommend', {
      userId,
      includeAIReason: true,
    });

    logger.info(`[Recommend API] 管理员触发单用户推荐: ${userId}`);

    return c.json({
      code: 200,
      message: '推荐任务已触发',
      data: { userId }
    });
  } catch (error) {
    logger.error('[Recommend API] 触发单用户推荐失败', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json({
      code: 500,
      message: '触发推荐任务失败',
      data: null
    }, 500);
  }
});

/**
 * v3 接口：触发全量推荐（管理员接口）
 * POST /api/v3/recommendations/batch
 */
const BatchRecommendSchema = z.object({
  targetDate: z.string().optional(), // 可选，指定日期，默认今天
});

router.post(
  '/recommendations/batch',
  zValidator('json', BatchRecommendSchema),
  async (c) => {
    const data = c.req.valid('json');

    try {
      // 添加到批量推荐队列
      await recommendQueue.add('batch-recommend', {
        targetDate: data.targetDate || new Date().toISOString().split('T')[0],
      });

      logger.info(`[Recommend API] 管理员触发全量推荐`);

      return c.json({
        code: 200,
        message: '全量推荐任务已触发',
        data: { targetDate: data.targetDate || new Date().toISOString().split('T')[0] }
      });
    } catch (error) {
      logger.error('[Recommend API] 触发全量推荐失败', {
        error: error instanceof Error ? error.message : String(error)
      });

      return c.json({
        code: 500,
        message: '触发全量推荐任务失败',
        data: null
      }, 500);
    }
  }
);

/**
 * v3 接口：获取推荐统计（管理员接口）
 * GET /api/v3/recommendations/stats
 */
router.get('/recommendations/stats', async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 统计今日推荐覆盖情况
    const allRecommendations = await db.select().from(dailyRecommendations);
    const todayRecommendations = allRecommendations.filter(r => r.calculateDate === today);

    const stats = {
      totalUsers: allRecommendations.length,
      todayCoverage: todayRecommendations.length,
      todayCoverageRate: 0,
      avgRecommendationCount: 0,
      reasonGeneratedCount: 0,
      reasonGeneratedRate: 0,
    };

    if (allRecommendations.length > 0) {
      stats.todayCoverageRate = Math.round((todayRecommendations.length / allRecommendations.length) * 100);
    }

    if (todayRecommendations.length > 0) {
      let totalRecommendations = 0;
      let reasonGeneratedTotal = 0;

      todayRecommendations.forEach(rec => {
        const recommendUsers = rec.recommendeUsers as any[];
        totalRecommendations += recommendUsers.length;
        reasonGeneratedTotal += recommendUsers.filter((r: any) => r.reasonGenerated).length;
      });

      stats.avgRecommendationCount = Math.round(totalRecommendations / todayRecommendations.length);
      stats.reasonGeneratedCount = reasonGeneratedTotal;
      stats.reasonGeneratedRate = totalRecommendations > 0
        ? Math.round((reasonGeneratedTotal / totalRecommendations) * 100)
        : 0;
    }

    return c.json({
      code: 200,
      message: '获取推荐统计成功',
      data: stats
    });
  } catch (error) {
    logger.error('[Recommend API] 获取推荐统计失败', {
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json({
      code: 500,
      message: '获取推荐统计失败',
      data: null
    }, 500);
  }
});

export default router;
