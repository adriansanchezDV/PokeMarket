import { z } from 'zod';

export const createSellerProfileSchema = z.object({
  storeName: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
});

export const updateSellerProfileSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
});
