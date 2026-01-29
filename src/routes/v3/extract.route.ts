import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExtractUserProfileTagWithStorageSchema } from '../../types/user.profile.type';
import * as tagService from '../../services/tag.service';
import { logger } from '../../config/logger';

const router = new Hono();

/**
 * v3 接口：抽取用户标签并存储完整信息
 * 入参包含完整的用户信息字段，用于推荐算法
 */
router.post(
  '/extractUserProfileTags',
  // 1. 在路由处直接进行 Zod 校验
  zValidator('json', ExtractUserProfileTagWithStorageSchema, (result, c) => {
    if (!result.success) {
      // 如果校验失败，直接返回统一的错误格式
      return c.json({
        code: 400,
        message: result.error.message,
        data: null
      }, 400);
    }
  }),
  // 2. 处理函数
  async (c) => {
    const data = c.req.valid('json');

    try {
      // 调用服务层：抽取标签并存储到数据库
      const result = await tagService.extractUserProfileTagsWithStorage(data);

      // 记录日志
      logger.info('v3 Service Execution Success', {
        user_uuid: data.user_uuid,
        output: result
      });

      // 返回标签抽取结果
      return c.json({
        code: 200,
        message: '标签抽取并存储成功',
        data: result
      });
    } catch (error) {
      // 错误处理
      logger.error('v3 Service Execution Failed', {
        user_uuid: data.user_uuid,
        error: error instanceof Error ? error.message : String(error)
      });

      return c.json({
        code: 500,
        message: '标签抽取或存储失败',
        data: null
      }, 500);
    }
  }
);

export default router;
