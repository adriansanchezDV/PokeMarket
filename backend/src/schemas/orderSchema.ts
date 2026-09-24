import { z } from 'zod';

export const createOrderSchema = z.object({
  shippingAddress: z.object({
    street: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(100),
  }),
});

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
});
