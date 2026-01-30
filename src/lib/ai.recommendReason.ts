import OpenAI from 'openai';
import { config } from '../config/logger';

const openai = new OpenAI();

// 生成个性化推荐理由
export async function generateRecommendationReason(
  currentUser: any,
  targetUser: any,
  matchedTags: string[],
  score: number,
  isPriority: boolean
): Promise<string> {
  try {
    // 构建用户画像摘要
    const userSummary = buildUserSummary(currentUser);
    const targetSummary = buildUserSummary(targetUser);

    // 构建提示词
    const prompt = buildRecommendPrompt(
      userSummary,
      targetSummary,
      matchedTags,
      score,
      isPriority
    );

    // 调用 AI 生成推荐理由
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || '';
    return text.trim();
  } catch (error) {
    config.logger.error('[AI Recommend Reason] 生成推荐理由失败:', error);
    return generateFallbackReason(currentUser, targetUser, matchedTags, isPriority);
  }
}

// 构建用户画像摘要
function buildUserSummary(user: any): string {
  const parts = [];

  if (user.age) parts.push(`${user.age}岁`);
  if (user.height) parts.push(`${user.height}cm`);
  if (user.currentCity) parts.push(`来自${user.currentCity}`);
  if (user.occupation) parts.push(`从事${user.occupation}`);
  if (user.maritalStatus) parts.push(`婚姻状态：${user.maritalStatus}`);

  return parts.join('，') || '暂无详细信息';
}

// 构建推荐提示词
function buildRecommendPrompt(
  userSummary: string,
  targetSummary: string,
  matchedTags: string[],
  score: number,
  isPriority: boolean
): string {
  const priorityHint = isPriority ? '（对方最近喜欢过你）' : '';
  const scoreLevel = score > 0.8 ? '高度匹配' : score > 0.6 ? '比较匹配' : '可能适合你';
  const tagHint = matchedTags.length > 0 ? `共同兴趣标签：${matchedTags.join('、')}` : '';

  return `你是一个专业的婚恋推荐助手，需要为用户生成简洁、有吸引力的推荐理由。

当前用户画像：${userSummary}

推荐对象画像：${targetSummary}
匹配度：${scoreLevel}${priorityHint}
${tagHint}

请生成一个 30-50 字的推荐理由，要求：
1. 突出双方匹配点（如性格、兴趣、价值观等）
2. 语言自然、真诚、有吸引力
3. 避免空洞的赞美，要有具体内容
4. 如果是双向匹配（对方喜欢过你），可以适当提及
5. 不要提及"系统推荐"、"AI生成"等技术词汇

推荐理由：`;
}

// 生成备用推荐理由（当 AI 调用失败时）
function generateFallbackReason(
  currentUser: any,
  targetUser: any,
  matchedTags: string[],
  isPriority: boolean
): string {
  const reasons = [];

  // 标签匹配
  if (matchedTags.length > 0) {
    reasons.push(`你们在${matchedTags.slice(0, 2).join('、')}等方面有共同点`);
  }

  // 年龄差
  if (currentUser.age && targetUser.age) {
    const ageDiff = Math.abs(currentUser.age - targetUser.age);
    if (ageDiff <= 2) {
      reasons.push('年龄相仿');
    }
  }

  // 城市匹配
  if (currentUser.currentCity && targetUser.currentCity &&
      currentUser.currentCity === targetUser.currentCity) {
    reasons.push('同城匹配');
  }

  // 双向匹配
  if (isPriority) {
    reasons.push('对方最近喜欢过你');
  }

  if (reasons.length === 0) {
    return '对方看起来很适合你，可以尝试了解';
  }

  return reasons.join('，') + '，可以尝试了解';
}
