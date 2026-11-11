import { AppError } from '../utils/AppError.js';
import { col } from 'sequelize';
import sequelize from '../config/database.js';
import Cart from '../models/CartModel.js';
import {
  Card,
  CartItem,
  Order,
  OrderItem,
  Product,
  SellerProfile,
  ShippingAddress,
} from '../models/indexModel.js';
import { createNotification } from './notificationService.js';
import { requireActiveSellerProfile } from './sellerProfileService.js';
import { requireActiveProduct } from './productService.js';
import { invalidateCardDetailCache } from './cache/cardsCacheService.js';

export const createOrder = async (userId: number, shippingAddressId: number) => {
  return sequelize.transaction(async (transaction) => {
    const cart = await Cart.findOne({
      where: { userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cart) {
      throw new AppError(404, 'Cart not found');
    }

    const items = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'sellerProfileId'],
        },
      ],
      transaction,
    });

    if (items.length === 0) {
      throw new AppError(409, 'Cart is empty');
    }

    // Comprobamos que la dirección existe y pertenece al usuario
    const shippingAddress = await ShippingAddress.findOne({
      where: {
        id: shippingAddressId,
        userId,
      },
      transaction,
    });

    if (!shippingAddress) {
      throw new AppError(404, 'Shipping address not found');
    }

    const sellerIds = items.map((item) => {
      const product = item.get('product') as Product;
      if (!product) {
        throw new AppError(404, 'Product not found');
      }
      return product.sellerProfileId;
    });
    await requireActiveSellerProfile(sellerIds, transaction);

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Product.findAll({
      where: { id: productIds },
      include: [
        { model: Card, as: 'card' },
        { model: SellerProfile, as: 'sellerProfile' },
      ],
      order: [['id', 'ASC']],
      transaction,
      lock: { level: transaction.LOCK.UPDATE, of: Product },
    });

    if (products.length !== productIds.length) {
      throw new AppError(404, 'Product not found');
    }
    products.forEach(requireActiveProduct);
    const productsById = new Map(products.map((product) => [product.id, product]));

    let total = 0;

    for (const item of items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new AppError(404, 'Product not found');
      }

      if (product.stock < item.quantity) {
        throw new AppError(409, `Insufficient stock for product ${product.id}`);
      }

      total += Number(product.price) * item.quantity;
    }

    // Guardamos una copia de la dirección.
    // El pedido no depende de la dirección guardada después de crearse.
    const order = await Order.create(
      {
        userId,
        status: 'pending',
        total: total.toFixed(2),
        shippingAddress: {
          recipientName: shippingAddress.recipientName,
          street: shippingAddress.street,
          city: shippingAddress.city,
          postalCode: shippingAddress.postalCode,
          province: shippingAddress.province,
          country: shippingAddress.country,
          phone: shippingAddress.phone,
        },
      },
      { transaction },
    );

    for (const item of items) {
      const product = productsById.get(item.productId)!;
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
  const cardIds = new Set<number>();
  const order = await sequelize.transaction(async (transaction) => {
    const order = await Order.findOne({
      where: {
        id: orderId,
        userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.status !== 'pending') {
      throw new AppError(409, 'Order cannot be paid');
    }

    await order.reload({
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: SellerProfile,
              as: 'sellerProfile',
            },
          ],
        },
      ],
      transaction,
    });

    const items = order.get('items') as OrderItem[];
    const stockItems = [...items].sort((a, b) => (a.productId ?? 0) - (b.productId ?? 0));

    const sellerIds = items.map((item) => {
      if (item.sellerProfileId === null) {
        throw new AppError(409, 'Order cannot be paid');
      }
      return item.sellerProfileId;
    });
    await requireActiveSellerProfile(sellerIds, transaction);

    // Comprobamos y descontamos el stock al pagar
    for (const item of stockItems) {
      if (!item.productId) {
        throw new AppError(404, 'Product not found');
      }

      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!product) {
        throw new AppError(404, 'Product not found');
      }

      requireActiveProduct(product);

      if (product.sellerProfileId !== item.sellerProfileId) {
        throw new AppError(409, 'Order cannot be paid');
      }

      if (product.stock < item.quantity) {
        throw new AppError(409, `Insufficient stock for product ${product.id}`);
      }

      product.stock -= item.quantity;

      await product.save({ transaction });
      cardIds.add(product.cardId);
    }

    // El pago pasa el pedido a paid
    order.status = 'paid';
    await order.save({ transaction });

    // Todos los productos pasan a processing
    for (const item of items) {
      item.status = 'processing';
      await item.save({ transaction });
    }

    const sellerUserIds = [
      ...new Set(
        items
          .map((item) => {
            const sellerProfile = item.get('sellerProfile') as SellerProfile;

            return sellerProfile?.userId;
          })
          .filter((userId): userId is number => userId !== undefined),
      ),
    ];

    for (const sellerUserId of sellerUserIds) {
      await createNotification({
        userId: sellerUserId,
        type: 'NEW_SALE',
        title: 'Nueva venta',
        message: 'Has recibido una nueva venta.',
        transaction,
      });
    }

    return order;
  });

  await invalidateCardDetailCache([...cardIds]);
  return order;
};

export const cancelOrder = async (userId: number, orderId: number) => {
  const cardIds = new Set<number>();
  const order = await sequelize.transaction(async (transaction) => {
    const order = await Order.findOne({
      where: {
        id: orderId,
        userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (!['pending', 'paid'].includes(order.status)) {
      throw new AppError(409, 'Order cannot be cancelled');
    }

    await order.reload({
      include: [
        {
          model: OrderItem,
          as: 'items',
        },
      ],
      transaction,
    });

    const items = order.get('items') as OrderItem[];
    const stockItems = [...items].sort((a, b) => (a.productId ?? 0) - (b.productId ?? 0));

    for (const item of items) {
      if (!['pending', 'processing'].includes(item.status)) {
        throw new AppError(409, 'Order cannot be cancelled');
      }
    }

    for (const item of stockItems) {
      if (order.status === 'paid' && item.productId) {
        const product = await Product.findByPk(item.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (product) {
          product.stock += item.quantity;
          await product.save({ transaction });
          cardIds.add(product.cardId);
        }
      }

      item.status = 'cancelled';
      await item.save({ transaction });
    }

    order.status = 'cancelled';
    await order.save({ transaction });

    await createNotification({
      userId: order.userId,
      type: 'ORDER_CANCELLED',
      title: 'Pedido cancelado',
      message: 'Tu pedido ha sido cancelado.',
      transaction,
    });

    return order;
  });

  await invalidateCardDetailCache([...cardIds]);
  return order;
};
