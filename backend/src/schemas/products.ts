import { z } from 'zod';

export const createProductSchema = z.object({
  cardId: z.number().int().positive(),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  condition: z.string().min(1).max(50),
});
