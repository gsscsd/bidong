import { callQwenAI } from '../lib/ai.chat';
import { EXTRACT_USER_PROFILE_TAGS_PROMPT } from '../constants/prompts';
import type { CreateExtractUserInfoTagDto, CreateExtractUserProfileTagDto, CreateExtractUserProfileTagWithStorageDto } from '../types/user.profile.type';
import { logger } from '../config/logger';
import { ChatMessages } from '../types/ai.type';
import { upsertUserProfileWithTags } from '../db/repos/tag.repos';

export const extractUserProfileTags = async (dto: CreateExtractUserProfileTagDto) => {
  const message: ChatMessages = [
    { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
    { role: 'user', content: dto.user_introduces },
  ]
  const responseData = await callQwenAI(message);

  const content = responseData

  logger.info('大模型返回结果为: ', { content: content })

  if (!content) throw new Error('大模型返回内容为空');

  // 注意：此处不再返回 { code, message }，只返回业务数据
  // 统一格式由 Route 或中间件负责
  return typeof content === 'string' ? JSON.parse(content) : content;
};


export const extractUserInfoTags = async (dto: CreateExtractUserInfoTagDto) => {
  const message: ChatMessages = [
    { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
    { role: 'user', content: dto.user_introduces },
  ]
  const responseData = await callQwenAI(message);

  const content = responseData

  logger.info('大模型返回结果为: ', { content: content })

  if (!content) throw new Error('大模型返回内容为空');

  // 注意：此处不再返回 { code, message }，只返回业务数据
  // 统一格式由 Route 或中间件负责
  return typeof content === 'string' ? JSON.parse(content) : content;
};

/**
 * v3: 抽取用户标签并存储完整信息
 * 1. 调用AI抽取标签
 * 2. 将标签完整存入 tagsSnapshot 字段
 * 3. 将用户完整信息存入 recommendUserProfiles 表
 * 4. 返回抽取的标签结果
 */
export const extractUserProfileTagsWithStorage = async (dto: CreateExtractUserProfileTagWithStorageDto) => {
  try {
    // 1. 调用AI抽取标签
    const message: ChatMessages = [
      { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
      { role: 'user', content: dto.user_introduces },
    ];
    const responseData = await callQwenAI(message);
    const content = responseData;

    logger.info('大模型返回结果为: ', { content: content });

    if (!content) throw new Error('大模型返回内容为空');

    const tagsResult = typeof content === 'string' ? JSON.parse(content) : content;

    // 2. 存储到数据库
    await upsertUserProfileWithTags(dto, tagsResult);

    logger.info('用户信息存储成功', {
      user_uuid: dto.user_uuid,
      tags_snapshot: tagsResult,
    });

    // 3. 返回标签抽取结果
    return tagsResult;
  } catch (error) {
    logger.error('抽取标签并存储失败', {
      user_uuid: dto.user_uuid,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};