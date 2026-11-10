import { col, Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Order, OrderItem, SellerProfile } from '../models/indexModel.js';
import { createNotification } from './notificationService.js';

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

  return sequelize.transaction(async (transaction) => {
    const orderItem = await OrderItem.findOne({
      where: {
        id: orderItemId,
        sellerProfileId: sellerProfile.id,
      },
      transaction,
    });

    if (!orderItem) {
      throw new Error('Order item not found');
    }

    // El pago, la cancelacion y el vendedor bloquean el mismo pedido.
    const order = await Order.findByPk(orderItem.orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw new Error('Order item not found');
    }

    await orderItem.reload({ transaction });

    const validTransitions = {
      processing: ['shipped'],
      shipped: ['delivered'],
    };

    const allowedStatuses =
      validTransitions[orderItem.status as keyof typeof validTransitions] ?? [];

    if (order.status !== 'paid' || !allowedStatuses.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${orderItem.status} to ${newStatus}`);
    }

    orderItem.status = newStatus;

    await orderItem.save({ transaction });

    if (newStatus === 'shipped') {
      await createNotification({
        transaction,
        userId: order.userId,
        type: 'ORDER_SHIPPED',
        title: 'Pedido enviado',
        message: `Tu pedido ha sido enviado.`,
      });
    }

    if (newStatus === 'delivered') {
      await createNotification({
        transaction,
        userId: order.userId,
        type: 'ORDER_DELIVERED',
        title: 'Pedido entregado',
        message: 'Tu pedido ha sido entregado.',
      });

      const remainingItems = await OrderItem.count({
        transaction,
        where: {
          orderId: order.id,
          status: {
            [Op.not]: 'delivered',
          },
        },
      });

      if (remainingItems === 0) {
        order.status = 'completed';
        await order.save({ transaction });
      }
    }

    return Order.findByPk(orderItem.orderId, {
      transaction,
      include: [
        {
          model: OrderItem,
          as: 'items',
        },
      ],
    });
  });
};
