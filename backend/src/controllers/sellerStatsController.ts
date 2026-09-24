import type { RequestHandler } from 'express';
import { getSellerStats } from '../services/sellerStatsService.js';

export const getSellerStatsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const stats = await getSellerStats(req.user!.id);

    return res.status(200).json(stats);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Seller profile not found'
    ) {
      return res.status(404).json({
        error: error.message,
      });
    }

    next(error);
  }
};