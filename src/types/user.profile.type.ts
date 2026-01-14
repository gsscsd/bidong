import { z } from 'zod';

export const ExtractUserProfileTagSchema = z.object({
  user_id: z.string().uuid(),
  user_introduces: z.string().min(1, '用户介绍不能为空'),
  user_sex: z.enum(['男', '女', '其他']),
  user_age: z.number().int().min(1).max(150)
});

export type CreateExtractUserProfileTagDto = z.infer<typeof ExtractUserProfileTagSchema>;

export interface ExtractUserProfileTagResponse {
  code: number;
  message: string;
}