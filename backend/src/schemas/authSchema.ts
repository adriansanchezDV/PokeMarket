import { z } from 'zod';
import { normalizeEmail } from '../utils/email.js';

export const emailSchema = z.string().transform(normalizeEmail).pipe(z.string().email().max(254));

export const registerSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),

  email: emailSchema,

  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: emailSchema,

  password: z.string().min(1),
});
