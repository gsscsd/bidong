import { z } from 'zod';

// v1 版本：包含部分用户信息
export const ExtractUserProfileTagSchema = z.object({
  user_id: z.string().nonempty(),
  user_introduces: z.string().nonempty(),
  user_sex: z.string().nonempty(),
  user_age: z.number().nonnegative()
});

// v2 版本：仅需要用户描述
export const ExtractUserInfoTagSchema = z.object({
  user_introduces: z.string().nonempty(),
});

// v3 版本：包含完整用户信息，用于数据存储
export const ExtractUserProfileTagWithStorageSchema = z.object({
  user_uuid: z.string().nonempty(), // 用户唯一标识，对应 recommendUserProfiles.user_uuid
  user_introduces: z.string().nonempty(), // 用户自我介绍，用于AI标签抽取
  // 以下字段均为可选，用于推荐算法的特征过滤
  gender: z.number().int().min(1).max(2).optional(), // 性别：1-男，2-女
  age: z.number().int().min(1).max(120).optional(), // 年龄
  height: z.number().int().min(100).max(250).optional(), // 身高
  current_city: z.string().max(100).optional(), // 当前城市
  marital_status: z.number().int().optional(), // 婚姻状态（枚举值根据业务定义）
  education: z.number().int().optional(), // 教育程度（枚举值根据业务定义）
  occupation: z.string().max(100).optional(), // 职业
  annual_income: z.string().max(100).optional(), // 年收入
});

export type CreateExtractUserProfileTagDto = z.infer<typeof ExtractUserProfileTagSchema>;
export type CreateExtractUserInfoTagDto = z.infer<typeof ExtractUserInfoTagSchema>;
export type CreateExtractUserProfileTagWithStorageDto = z.infer<typeof ExtractUserProfileTagWithStorageSchema>;

export interface CommonResponse {
  code: number;
  message: string;
}