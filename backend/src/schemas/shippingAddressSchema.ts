import { z } from 'zod';

export const createShippingAddressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, 'Recipient name must have at least 2 characters')
    .max(150, 'Recipient name must have at most 150 characters'),

  street: z
    .string()
    .trim()
    .min(3, 'Street must have at least 3 characters')
    .max(255, 'Street must have at most 255 characters'),

  city: z
    .string()
    .trim()
    .min(2, 'City must have at least 2 characters')
    .max(100, 'City must have at most 100 characters'),

  postalCode: z
    .string()
    .trim()
    .min(3, 'Postal code must have at least 3 characters')
    .max(20, 'Postal code must have at most 20 characters'),

  province: z
    .string()
    .trim()
    .min(2, 'Province must have at least 2 characters')
    .max(100, 'Province must have at most 100 characters'),

  country: z
    .string()
    .trim()
    .min(2, 'Country must have at least 2 characters')
    .max(100, 'Country must have at most 100 characters'),

  phone: z
    .string()
    .trim()
    .min(7, 'Phone must have at least 7 characters')
    .max(30, 'Phone must have at most 30 characters'),

  isDefault: z.boolean().optional(),
});

export const updateShippingAddressSchema = createShippingAddressSchema.partial();
