import { OpenAI } from 'openai';

// 定义消息类型（这是 OpenAI SDK 提供的类型，比 any[] 更安全）
export type ChatMessages = OpenAI.Chat.Completions.ChatCompletionMessageParam[];