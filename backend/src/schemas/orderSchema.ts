import { z } from 'zod';

export const createOrderSchema = z.object({
  shippingAddressId: z.number().int().positive(),
});

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
});
