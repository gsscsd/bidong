import { z } from 'zod';

export const ExtractUserProfileTagSchema = z.object({
  user_id: z.string().nonempty(),
  user_introduces: z.string().nonempty(),
  user_sex: z.string().nonempty(),
  user_age: z.number().nonnegative(),
  height: z.number().positive().optional(),
  education: z.number().int().min(1).max(10).optional(), // 1-小学 2-初中 3-高中 4-大专 5-本科 6-硕士 7-博士等
  current_city: z.string().optional(),
  marital_status: z.number().int().min(1).max(5).optional(), // 1-单身 2-已婚 3-离异 4-丧偶 5-其他
  occupation: z.string().optional(),
  annual_income: z.string().optional(),
});

export const ExtractUserInfoTagSchema = z.object({
  user_introduces: z.string().nonempty(),
});

export type CreateExtractUserProfileTagDto = z.infer<typeof ExtractUserProfileTagSchema>;
export type CreateExtractUserInfoTagDto = z.infer<typeof ExtractUserInfoTagSchema>;

export interface CommonResponse {
  code: number;
  message: string;
}

// 用户资料存储接口
export interface UserProfileData {
  userUuid: string;
  gender?: number;
  age?: number;
  height?: number;
  currentCity?: string;
  maritalStatus?: number;
  education?: number;
  occupation?: string;
  annualIncome?: string;
  embedding?: number[];
  tagIds?: number[];
  l1TagIds?: number[];
  l2TagIds?: number[];
  l3TagIds?: number[];
  tagsSnapshot?: any;
}