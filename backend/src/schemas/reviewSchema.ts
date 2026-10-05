import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),

  comment: z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be between 1 and 5')
      .max(5, 'Rating must be between 1 and 5')
      .optional(),

    comment: z
      .string()
      .trim()
      .max(1000, 'Comment cannot exceed 1000 characters')
      .nullable()
      .optional(),
  })
  .refine((data) => data.rating !== undefined || data.comment !== undefined, {
    message: 'At least one field must be provided',
  });

export const getProductReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(50).default(10),
});
