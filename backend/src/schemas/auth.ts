import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),

  email: z.string().email(),

  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),

  password: z.string().min(1),
});
