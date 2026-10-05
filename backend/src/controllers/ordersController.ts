import type { RequestHandler } from 'express';

import {
  cancelOrder,
  createOrder,
  getOrderById,
  getUserOrders,
  payOrder,
} from '../services/orderService.js';

export const createNewOrder: RequestHandler = async (req, res, next) => {
  try {
    const order = await createOrder(req.user!.id, req.body.shippingAddress);

    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Cart not found' ||
        error.message === 'Cart is empty' ||
        error.message === 'Product not found'
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }

      if (error.message.startsWith('Insufficient stock')) {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const getOrders: RequestHandler = async (req, res, next) => {
  try {
    const orders = await getUserOrders(req.user!.id);

    return res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrder: RequestHandler = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        error: 'Invalid order id',
      });
    }

    const order = await getOrderById(req.user!.id, orderId);

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

export const payOrderController: RequestHandler = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        error: 'Invalid order id',
      });
    }

    const order = await payOrder(req.user!.id, orderId);

    return res.status(200).json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Order not found') {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (error.message === 'Order cannot be paid') {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const cancelOrderController: RequestHandler = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        error: 'Invalid order id',
      });
    }

    const order = await cancelOrder(req.user!.id, orderId);

    return res.status(200).json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Order not found') {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (error.message === 'Order cannot be cancelled') {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};
