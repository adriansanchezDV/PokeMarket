import { Order, OrderItem, Product, Review, User } from '../models/indexModel.js';
import { AppError } from '../utils/AppError.js';

export const createReview = async (
  userId: number,
  productId: number,
  rating: number,
  comment?: string,
) => {
  const product = await Product.findByPk(productId);

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const purchasedProduct = await OrderItem.findOne({
    where: {
      productId,
    },
    include: [
      {
        model: Order,
        as: 'order',
        where: {
          userId,
          status: 'completed',
        },
        attributes: ['id', 'userId', 'status'],
      },
    ],
  });

  if (!purchasedProduct) {
    throw new AppError(403, 'You can only review products you have purchased');
  }

  const existingReview = await Review.findOne({
    where: {
      userId,
      productId,
    },
  });

  if (existingReview) {
    throw new AppError(409, 'You have already reviewed this product');
  }

  return Review.create({
    userId,
    productId,
    rating,
    comment: comment ?? null,
  });
};

export const getProductReviews = async (
  productId: number,
  page: number,
  limit: number,
  userId?: number,
) => {
  const product = await Product.findByPk(productId);

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const offset = (page - 1) * limit;

  const allReviews = await Review.findAll({
    where: {
      productId,
    },
    attributes: ['rating'],
  });

  const reviewCount = allReviews.length;

  const averageRating =
    reviewCount > 0 ? allReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0;

  const ratingDistribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  for (const review of allReviews) {
    ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
  }

  const reviews = await Review.findAll({
    where: {
      productId,
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fullName'],
      },
    ],
    attributes: ['id', 'rating', 'comment', 'createdAt', 'updatedAt'],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const totalPages = reviewCount > 0 ? Math.ceil(reviewCount / limit) : 0;

  const userReview = userId
    ? await Review.findOne({
        where: {
          productId,
          userId,
        },
        attributes: ['id', 'rating', 'comment', 'createdAt', 'updatedAt'],
      })
    : null;

  return {
    productId,
    averageRating: Number(averageRating.toFixed(2)),
    reviewCount,
    ratingDistribution,
    page,
    limit,
    totalPages,
    userReview,
    reviews,
  };
};

export const updateReview = async (
  userId: number,
  productId: number,
  reviewId: number,
  rating?: number,
  comment?: string | null,
) => {
  const review = await Review.findOne({
    where: {
      id: reviewId,
      productId,
      userId,
    },
  });

  if (!review) {
    throw new AppError(404, 'Review not found');
  }

  if (rating !== undefined) {
    review.rating = rating;
  }

  if (comment !== undefined) {
    review.comment = comment;
  }

  await review.save();

  return review;
};

export const deleteReview = async (userId: number, productId: number, reviewId: number) => {
  const review = await Review.findOne({
    where: {
      id: reviewId,
      productId,
      userId,
    },
  });

  if (!review) {
    throw new AppError(404, 'Review not found');
  }

  await review.destroy();
};
