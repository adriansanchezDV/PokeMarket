import { z } from 'zod';

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});
