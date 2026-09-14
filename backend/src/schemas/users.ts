import { z } from 'zod';

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
});
