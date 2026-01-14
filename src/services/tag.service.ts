import { callQwenAI } from '../lib/ai-client';
import { EXTRACT_USER_PROFILE_TAGS_PROMPT } from '../constants/prompts';
import type { CreateExtractUserProfileTagDto } from '../types/user.profile.type';

export const extractUserProfileTags = async (dto: CreateExtractUserProfileTagDto) => {
  const responseData = await callQwenAI([
    { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
    { role: 'user', content: dto.user_introduces },
  ]);

  const content = responseData.choices?.[0]?.message?.content;
  if (!content) throw new Error('大模型返回内容为空');

  // 注意：此处不再返回 { code, message }，只返回业务数据
  // 统一格式由 Route 或中间件负责
  return typeof content === 'string' ? JSON.parse(content) : content;
};