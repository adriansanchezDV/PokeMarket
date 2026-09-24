import { col, Op } from 'sequelize';
import { Order, OrderItem, SellerProfile } from '../models/indexModel.js';

export const getSellerOrders = async (userId: number) => {
  const sellerProfile = await SellerProfile.findOne({
    where: { userId },
  });

  if (!sellerProfile) {
    throw new Error('Seller profile not found');
  }

  return OrderItem.findAll({
    where: {
      sellerProfileId: sellerProfile.id,
    },
    include: [
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'userId', 'status', 'total', 'shippingAddress', 'created_at'],
      },
    ],
    order: [[col('OrderItem.created_at'), 'DESC']],
  });
};

export const updateSellerOrderItemStatus = async (
  userId: number,
  orderItemId: number,
  newStatus: 'shipped' | 'delivered',
) => {
  const sellerProfile = await SellerProfile.findOne({
    where: { userId },
  });

  if (!sellerProfile) {
    throw new Error('Seller profile not found');
  }

  const orderItem = await OrderItem.findOne({
    where: {
      id: orderItemId,
      sellerProfileId: sellerProfile.id,
    },
    include: [
      {
        model: Order,
        as: 'order',
      },
    ],
  });

  if (!orderItem) {
    throw new Error('Order item not found');
  }

  const validTransitions = {
    processing: ['shipped'],
    shipped: ['delivered'],
  };

  const allowedStatuses = validTransitions[orderItem.status as keyof typeof validTransitions] ?? [];

  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${orderItem.status} to ${newStatus}`);
  }

  orderItem.status = newStatus;

  await orderItem.save();

  if (newStatus === 'delivered') {
    const order = orderItem.get('order') as Order;

    const remainingItems = await OrderItem.count({
      where: {
        orderId: order.id,
        status: {
          [Op.not]: 'delivered',
        },
      },
    });

    if (remainingItems === 0) {
      order.status = 'completed';
      await order.save();
    }
  }

  return Order.findByPk(orderItem.orderId, {
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
    ],
  });
};
