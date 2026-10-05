import type { Request, Response, NextFunction } from 'express';

import {
  createReview as createReviewService,
  getProductReviews as getProductReviewsService,
  updateReview as updateReviewService,
  deleteReview as deleteReviewService,
} from '../services/reviewService.js';
import { getProductReviewsSchema } from '../schemas/reviewSchema.js';

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    const { rating, comment } = req.body;

    const review = await createReviewService(userId, productId, rating, comment);

    return res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    const { page, limit } = getProductReviewsSchema.parse(req.query);

    const userId = req.user?.id;

    const result = await getProductReviewsService(productId, page, limit, userId);

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const productId = Number(req.params.productId);
    const reviewId = Number(req.params.reviewId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        error: 'Invalid review id',
      });
    }

    const { rating, comment } = req.body;

    const review = await updateReviewService(userId, productId, reviewId, rating, comment);

    return res.json(review);
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const productId = Number(req.params.productId);
    const reviewId = Number(req.params.reviewId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        error: 'Invalid review id',
      });
    }

    await deleteReviewService(userId, productId, reviewId);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
