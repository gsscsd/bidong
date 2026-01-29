import OpenAI from 'openai';
import { logger } from '../config/logger'; 
import { ChatMessages }  from "../types/ai.type"

// 1. 初始化 Client (单例模式)
// 放在函数外部，保证整个应用运行期间只初始化一次
const client = new OpenAI({
  apiKey: Bun.env.API_KEY,
  baseURL: Bun.env.API_BASE_URL,
});

/**
 * 普通对话（一次性返回）
 * 适用于：需要 JSON 格式输出、短对话、不需要实时反馈的场景
 */
export const callQwenAI = async (messages: ChatMessages) => {
  try {
    const completion = await client.chat.completions.create({
      model: Bun.env.API_MODEL || 'qwen-turbo',
      messages: messages,
      // 注意：使用 json_object 模式时，Prompt 中必须包含 "JSON" 字样
      response_format: { type: 'json_object' }, 
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error('AI 普通调用失败', error);
    throw error;
  }
};

/**
 * 流式对话（实时返回）
 * 适用于：长文本生成、聊天机器人、需要打字机效果的场景
 */
export const callQwenAIStream = async function* (messages: ChatMessages) {
  logger.info(`开始流式调用 Qwen...`);

  try {
    const stream = await client.chat.completions.create({
      model: Bun.env.API_MODEL || 'qwen-turbo',
      messages: messages,
      stream: true, // 开启流式
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      logger.error(`OpenAI API 错误: ${error.status}`, error.message);
    } else {
      logger.error('网络或其他错误', error);
    }
    throw error;
  }
};