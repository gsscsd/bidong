import { callQwenAI } from '../lib/ai-client';
import { EXTRACT_USER_PROFILE_TAGS_PROMPT } from '../constants/prompts';
import type { CreateExtractUserInfoTagDto, CreateExtractUserProfileTagDto } from '../types/user.profile.type';
import { logger } from '../config/logger';

export const extractUserProfileTags = async (dto: CreateExtractUserInfoTagDto) => {
  const responseData = await callQwenAI([
    { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
    { role: 'user', content: dto.user_introduces },
  ]);

  const content = responseData.choices?.[0]?.message?.content;

  logger.info('大模型返回结果为: ', {content: content})

  if (!content) throw new Error('大模型返回内容为空');

  // 注意：此处不再返回 { code, message }，只返回业务数据
  // 统一格式由 Route 或中间件负责
  return typeof content === 'string' ? JSON.parse(content) : content;
};