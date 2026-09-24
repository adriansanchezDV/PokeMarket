import { col } from 'sequelize';
import sequelize from '../config/database.js';
import Cart from '../models/CartModel.js';
import { Card, CartItem, Order, OrderItem, Product, SellerProfile } from '../models/indexModel.js';

export const createOrder = async (
  userId: number,
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  },
) => {
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
                {
                  model: SellerProfile,
                  as: 'sellerProfile',
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
        shippingAddress,
      },
      { transaction },
    );

    for (const item of items) {
      const product = item.get('product') as Product;
      const card = product.get('card') as Card;
      const sellerProfile = product.get('sellerProfile') as SellerProfile;

      if (!sellerProfile) {
        throw new Error('Seller profile not found');
      }

      await OrderItem.create(
        {
          orderId: order.id,
          productId: product.id,
          unitPrice: product.price,
          quantity: item.quantity,
          productName: card.name,
          condition: product.condition,
          language: product.language,
          sellerProfileId: sellerProfile.id,
          sellerName: sellerProfile.storeName,
          status: 'pending',
        },
        { transaction },
      );
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

export const getOrderById = async (userId: number, orderId: number) => {
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

export const payOrder = async (userId: number, orderId: number) => {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findOne({
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
      transaction,
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Order cannot be paid');
    }

    const items = order.get('items') as OrderItem[];

    // Comprobamos y descontamos el stock al pagar
    for (const item of items) {
      if (!item.productId) {
        throw new Error('Product not found');
      }

      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.id}`);
      }

      product.stock -= item.quantity;

      await product.save({ transaction });
    }

    // El pago pasa el pedido a paid
    order.status = 'paid';
    await order.save({ transaction });

    // Todos los productos pasan a processing
    for (const item of items) {
      item.status = 'processing';
      await item.save({ transaction });
    }

    return order;
  });
};

export const cancelOrder = async (userId: number, orderId: number) => {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findOne({
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
      transaction,
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!['pending', 'paid'].includes(order.status)) {
      throw new Error('Order cannot be cancelled');
    }

    const items = order.get('items') as OrderItem[];

    for (const item of items) {
      if (!['pending', 'processing'].includes(item.status)) {
        throw new Error('Order cannot be cancelled');
      }
    }

    for (const item of items) {
      if (item.productId) {
        const product = await Product.findByPk(item.productId, {
          transaction,
        });

        if (product) {
          product.stock += item.quantity;
          await product.save({ transaction });
        }
      }

      item.status = 'cancelled';
      await item.save({ transaction });
    }

    order.status = 'cancelled';
    await order.save({ transaction });

    return order;
  });
};
