import type { RequestHandler } from 'express';

import { getSellerOrders, updateSellerOrderItemStatus } from '../services/sellerOrderService.js';

export const getSellerOrdersController: RequestHandler = async (req, res, next) => {
  try {
    const orders = await getSellerOrders(req.user!.id);

    return res.status(200).json(orders);
  } catch (error) {
    if (error instanceof Error && error.message === 'Seller profile not found') {
      return res.status(404).json({
        error: error.message,
      });
    }

    next(error);
  }
};

export const updateSellerOrderItemStatusController: RequestHandler = async (req, res, next) => {
  try {
    const orderItemId = Number(req.params.itemId);

    if (!Number.isInteger(orderItemId) || orderItemId <= 0) {
      return res.status(400).json({
        error: 'Invalid order item id',
      });
    }

    const { status } = req.body;

    const orderItem = await updateSellerOrderItemStatus(req.user!.id, orderItemId, status);

    return res.status(200).json(orderItem);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Seller profile not found' ||
        error.message === 'Order item not found'
      ) {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (error.message.startsWith('Invalid status transition')) {
        return res.status(409).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};
