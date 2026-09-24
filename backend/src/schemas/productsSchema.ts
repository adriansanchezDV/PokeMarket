import { z } from 'zod';

export const createProductSchema = z.object({
  cardId: z.number().int().positive(),
  condition: z.string().min(1).max(20),
  language: z.string().min(1).max(50),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  description: z.string().optional(),
});

export const updateProductSchema = z
  .object({
    condition: z.string().min(1).max(20).optional(),
    language: z.string().min(1).max(50).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    description: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateProductStatusSchema = z.object({
  isActive: z.boolean(),
});
