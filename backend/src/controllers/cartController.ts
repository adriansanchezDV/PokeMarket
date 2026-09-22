import type { RequestHandler } from 'express';

import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeItemFromCart,
  clearCart,
} from '../services/cartService.js';

export const getUserCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await getCart(req.user!.id);

    return res.status(200).json(cart);
  } catch (error) {
    next(error);
  }
};

export const addCartItem: RequestHandler = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    const item = await addItemToCart(req.user!.id, productId);

    return res.status(201).json(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (error.message === 'Product out of stock' || error.message === 'Insufficient stock') {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const updateCartItemQuantity: RequestHandler = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    const item = await updateCartItem(req.user!.id, productId, req.body.quantity);

    return res.status(200).json(item);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Cart not found' || error.message === 'Cart item not found') {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (error.message === 'Insufficient stock') {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const deleteCartItem: RequestHandler = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product id',
      });
    }

    await removeItemFromCart(req.user!.id, productId);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Cart not found' || error.message === 'Cart item not found') {
        return res.status(404).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const deleteCart: RequestHandler = async (req, res, next) => {
  try {
    await clearCart(req.user!.id);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
