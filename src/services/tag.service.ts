import { callQwenAI } from '../lib/ai.chat';
import { EXTRACT_USER_PROFILE_TAGS_PROMPT } from '../constants/prompts';
import type { CreateExtractUserInfoTagDto, CreateExtractUserProfileTagDto, UserProfileData } from '../types/user.profile.type';
import { logger } from '../config/logger';
import { ChatMessages } from '../types/ai.type';
import { upsertUserProfile } from '../db/repos/user.repos';

export const extractUserProfileTags = async (dto: CreateExtractUserProfileTagDto) => {
  const message: ChatMessages = [
    { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
    { role: 'user', content: dto.user_introduces },
  ]
  const responseData = await callQwenAI(message);

  const content = responseData

  logger.info('大模型返回结果为: ', { content: content })

  if (!content) throw new Error('大模型返回内容为空');

  // 解析AI返回的标签数据
  const tagsData = typeof content === 'string' ? JSON.parse(content) : content;

  try {
    // 构建用户资料数据
    const userProfileData: UserProfileData = {
      userUuid: dto.user_id,
      gender: dto.user_sex === '男' ? 1 : dto.user_sex === '女' ? 2 : undefined,
      age: dto.user_age,
      height: dto.height,
      currentCity: dto.current_city,
      maritalStatus: dto.marital_status,
      education: dto.education,
      occupation: dto.occupation,
      annualIncome: dto.annual_income,
      tagsSnapshot: tagsData, // 将AI返回的标签数据存储到快照字段
      // 暂时mock其他标签ID字段，实际项目中应该有标签映射逻辑
      tagIds: [],
      l1TagIds: [],
      l2TagIds: [],
      l3TagIds: [],
    };

    // 存储用户资料到数据库
    await upsertUserProfile(userProfileData);
    
    logger.info('用户资料存储成功', { userUuid: dto.user_id, profile: userProfileData });
  } catch (error) {
    logger.error('用户资料存储失败', { error: error instanceof Error ? error.message : String(error), userUuid: dto.user_id });
    // 不抛出错误，保证主要功能（标签提取）不受影响
  }

  // 注意：此处不再返回 { code, message }，只返回业务数据
  // 统一格式由 Route 或中间件负责
  return tagsData;
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