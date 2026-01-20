import { z } from 'zod';

export const ExtractUserProfileTagSchema = z.object({
  user_id: z.string().nonempty(),
  user_introduces: z.string().nonempty(),
  user_sex: z.string().nonempty(),
  user_age: z.number().nonnegative()
});

export type CreateExtractUserProfileTagDto = z.infer<typeof ExtractUserProfileTagSchema>;

export interface ExtractUserProfileTagResponse {
  code: number;
  message: string;
}