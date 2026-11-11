import { col } from 'sequelize';
import Product from '../models/ProductModel.js';
import SellerProfile from '../models/SellerProfileModel.js';
import OrderItem from '../models/OrderItemModel.js';
import Order from '../models/OrderModel.js';

export const getSellerStats = async (userId: number) => {
  const sellerProfile = await SellerProfile.findOne({
    where: { userId },
  });

  if (!sellerProfile) {
    throw new Error('Seller profile not found');
  }

  const products = await Product.findAll({
    where: {
      sellerProfileId: sellerProfile.id,
    },
  });

  const orderItems = await OrderItem.findAll({
    where: {
      sellerProfileId: sellerProfile.id,
    },
    include: [{ model: Order, as: 'order', attributes: ['status'] }],
  });

  const salesItems = orderItems.filter(
    (item) =>
      ['processing', 'shipped', 'delivered'].includes(item.status) &&
      ['paid', 'completed'].includes((item.get('order') as Order).status),
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const nextMonth = new Date(startOfMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthOrderItems = salesItems.filter((item) => {
    const createdAt = item.get('created_at') as Date;
    return createdAt >= startOfMonth && createdAt < nextMonth;
  });

  const recentOrders = await OrderItem.findAll({
    where: {
      sellerProfileId: sellerProfile.id,
    },
    include: [
      {
        association: 'order',
        attributes: ['id', 'status', ['created_at', 'createdAt']],
      },
    ],
    order: [[col('OrderItem.created_at'), 'DESC']],
    limit: 5,
  });

  return {
    products: {
      total: products.length,
      active: products.filter((product) => product.isActive).length,
      inactive: products.filter((product) => !product.isActive).length,
      outOfStock: products.filter((product) => product.stock === 0).length,
    },

    orders: {
      pending: orderItems.filter((item) => item.status === 'pending').length,
      processing: orderItems.filter((item) => item.status === 'processing').length,
      shipped: orderItems.filter((item) => item.status === 'shipped').length,
      delivered: orderItems.filter((item) => item.status === 'delivered').length,
      cancelled: orderItems.filter((item) => item.status === 'cancelled').length,
    },

    sales: {
      totalItems: salesItems.reduce((total, item) => total + item.quantity, 0),

      totalRevenue: salesItems
        .reduce((total, item) => total + Number(item.unitPrice) * item.quantity, 0)
        .toFixed(2),

      thisMonthItems: monthOrderItems.reduce((total, item) => total + item.quantity, 0),

      thisMonthRevenue: monthOrderItems
        .reduce((total, item) => total + Number(item.unitPrice) * item.quantity, 0)
        .toFixed(2),
    },
    recentOrders: recentOrders.map((item) => ({
      orderId: item.orderId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      status: item.status,
      createdAt: item.get('created_at') as Date,
    })),
  };
};
