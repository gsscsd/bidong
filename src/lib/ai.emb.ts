import OpenAI from 'openai';
import { logger } from '../config/logger';

// 1. 初始化硅基流动专用的 Client
// 注意：不要复用之前的 client，因为 BaseURL 不同
const siliconFlowClient = new OpenAI({
  // 硅基流动的 API Key
  apiKey: Bun.env.SILICONFLOW_API_KEY, 
  // 硅基流动的地址，通常是 https://api.siliconflow.cn/v1
  baseURL: Bun.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1', 
});

/**
 * 获取文本的向量 (Embeddings)
 * 支持单条文本或文本数组（批量处理）
 * 模型默认为: BAAI/bge-m3
 */
export const getEmbeddings = async (input: string | string[]) => {
  const modelName = 'BAAI/bge-m3'; // 硅基流动上的模型名称

  try {
    // 简单的预处理：有些 embedding 模型对换行符敏感，通常建议替换为空格
    const formattedInput = Array.isArray(input) 
      ? input.map(s => s.replace(/\n/g, ' ')) 
      : input.replace(/\n/g, ' ');

    const response = await siliconFlowClient.embeddings.create({
      model: modelName,
      input: formattedInput,
      encoding_format: 'float', // 返回浮点数数组
    });

    // 提取向量数据
    // response.data 是一个数组，对应输入的每一条文本
    const embeddings = response.data.map(item => item.embedding);

    logger.info(`向量化成功: 模型 ${modelName}, 数量 ${embeddings.length}`);

    // 如果输入是字符串，直接返回第一个向量；如果是数组，返回向量数组
    return Array.isArray(input) ? embeddings : embeddings[0];

  } catch (error) {
    logger.error('向量化调用失败', error);
    throw error;
  }
};