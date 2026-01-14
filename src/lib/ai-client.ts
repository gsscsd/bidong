import { logger } from '../config/logger';

export const callQwenAI = async (messages: any[]) => {
  const apiKey = Bun.env.apiKey;
  const baseUrl = Bun.env.apiBaseUrl;

  if (!apiKey || !baseUrl) {
    throw new Error('AI 服务配置未初始化，请检查环境变量');
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorDetail = await response.text();
    logger.error(`AI API 失败: ${response.status}`, { detail: errorDetail });
    throw new Error(`AI服务调用失败: ${response.status}`);
  }

  return await response.json();
};