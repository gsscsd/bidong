import { z } from 'zod';

export const ExtractUserProfileTagSchema = z.object({
  user_id: z.string().nonempty(),
  user_introduces: z.string().nonempty(),
  user_sex: z.string().nonempty(),
  user_age: z.number().nonnegative()
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