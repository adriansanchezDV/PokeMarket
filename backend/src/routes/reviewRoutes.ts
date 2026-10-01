import { Router } from 'express';

import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';

import { createReview, deleteReview, getProductReviews, updateReview } from '../controllers/reviewController.js';
import { createReviewSchema, updateReviewSchema } from '../schemas/reviewSchema.js';

const router = Router();

router.post(
  '/products/:productId/reviews',
  auth,
  validate(createReviewSchema),
  createReview,
);

router.get(
  '/products/:productId/reviews',
  getProductReviews,
);

router.patch(
  '/products/:productId/reviews/:reviewId',
  auth,
  validate(updateReviewSchema),
  updateReview,
);

router.delete(
  '/products/:productId/reviews/:reviewId',
  auth,
  deleteReview,
);

export default router;