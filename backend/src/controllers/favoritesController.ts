import type { RequestHandler } from 'express';
import { getUserFavorites, addFavorite, removeFavorite } from '../services/favoritesService.js';

export const getFavorites: RequestHandler = async (req, res, next) => {
  try {
    const favorites = await getUserFavorites(req.user!.id);

    return res.json(favorites);
  } catch (error) {
    next(error);
  }
};

export const createFavorite: RequestHandler = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({
        error: 'Invalid productId',
      });
    }

    try {
      const favorite = await addFavorite(req.user!.id, productId);

      return res.status(201).json(favorite);
    } catch (error) {
      if (error instanceof Error && error.message === 'Product not found') {
        return res.status(404).json({
          error: 'Product not found',
        });
      }

      if (error instanceof Error && error.message === 'Product already in favorites') {
        return res.status(409).json({
          error: 'Product already in favorites',
        });
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const deleteFavorite: RequestHandler = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({
        error: 'Invalid productId',
      });
    }

    const deleted = await removeFavorite(req.user!.id, productId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Favorite not found',
      });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
