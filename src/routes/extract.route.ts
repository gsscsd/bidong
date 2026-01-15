import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExtractUserProfileTagSchema } from '../types/user.profile.type';
// 导入函数式 Service
import * as tagService from '../services/tag.service';
import { logger } from '../config/logger';

const router = new Hono();

router.post(
    '/',
    // 1. 在路由处直接进行 Zod 校验
    zValidator('json', ExtractUserProfileTagSchema, (result, c) => {
        if (!result.success) {
            // 如果校验失败，直接返回统一的错误格式
            return c.json({
                code: 400,
                message: '参数校验失败',
                data: null
            }, 400);
        }
    }),
    // 2. 处理函数：注意这里不需要显式给 c 写类型，Hono 会自动推断
    async (c) => {
        const data = c.req.valid('json');
        const result = await tagService.extractUserProfileTags(data);

        // 使用 winston 的对象传参方式
        logger.info('Service Execution Success', { 
            output: result 
        });

        // 返回合格的结果
        return c.json({ code: 200, message: 'ok', data: result });
    }
);

export default router;