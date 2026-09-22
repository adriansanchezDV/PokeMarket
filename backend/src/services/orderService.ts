import { col } from 'sequelize';
import sequelize from '../config/database.js';
import Cart from '../models/CartModel.js';
import { Card, CartItem, Order, OrderItem, Product } from '../models/indexModel.js';

export const createOrder = async (userId: number) => {
  return sequelize.transaction(async (transaction) => {
    const cart = await Cart.findOne({
      where: { userId },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              include: [
                {
                  model: Card,
                  as: 'card',
                },
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    const items = cart.get('items') as CartItem[];

    if (items.length === 0) {
      throw new Error('Cart is empty');
    }

    let total = 0;

    for (const item of items) {
      const product = item.get('product') as Product;

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.id}`);
      }

      total += Number(product.price) * item.quantity;
    }

    const order = await Order.create(
      {
        userId,
        status: 'pending',
        total: total.toFixed(2),
      },
      { transaction },
    );

    for (const item of items) {
      const product = item.get('product') as Product;
      const card = product.get('card') as Card;

      await OrderItem.create(
        {
          orderId: order.id,
          productId: product.id,
          unitPrice: product.price,
          quantity: item.quantity,
          productName: card.name,
          condition: product.condition,
          language: product.language,
        },
        { transaction },
      );

      product.stock -= item.quantity;

      await product.save({ transaction });
    }

    await CartItem.destroy({
      where: {
        cartId: cart.id,
      },
      transaction,
    });

    return order;
  });
};


export const getUserOrders = async (userId: number) => {
  return Order.findAll({
    where: { userId },
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
    ],
    order: [[col('Order.created_at'), 'DESC']],
  });
};

export const getOrderById = async (
  userId: number,
  orderId: number,
) => {
  return Order.findOne({
    where: {
      id: orderId,
      userId,
    },
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
    ],
  });
};