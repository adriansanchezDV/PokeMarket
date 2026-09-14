import type { Request, Response, NextFunction } from 'express';

import { Product } from '../models/index.js';

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cardId, price, stock, condition } = req.body;

    const product = await Product.create({
      cardId,
      price,
      stock,
      condition,
      sellerProfileId: req.user!.id,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};
