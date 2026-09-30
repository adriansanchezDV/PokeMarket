import type { Request, Response, NextFunction } from 'express';

import {
  getStores as getStoresService,
  getStoreById as getStoreByIdService,
  getStoreProducts as getStoreProductsService,
} from '../services/storeService.js';

export const getStores = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const stores = await getStoresService();

    res.json(stores);
  } catch (error) {
    next(error);
  }
};

export const getStoreById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid store id',
      });
    }

    const store = await getStoreByIdService(id);

    if (!store) {
      return res.status(404).json({
        error: 'Store not found',
      });
    }

    res.json(store);
  } catch (error) {
    next(error);
  }
};

export const getStoreProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid store id',
      });
    }

    const products = await getStoreProductsService(id);

    if (products === null) {
      return res.status(404).json({
        error: 'Store not found',
      });
    }

    res.json(products);
  } catch (error) {
    next(error);
  }
};