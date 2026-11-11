import { z } from 'zod';
import { emailSchema } from './authSchema.js';

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  email: emailSchema.optional(),
});
