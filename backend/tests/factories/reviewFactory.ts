import { Review } from '../../src/models/indexModel.js';

export const createReview = (
  userId: number,
  productId: number,
  options: Partial<Pick<Review, 'rating' | 'comment' | 'createdAt'>> = {},
) => Review.create({ userId, productId, rating: 5, comment: null, ...options });
