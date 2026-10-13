import { col } from 'sequelize';
import { User, SellerProfile, Product, Order } from '../models/indexModel.js';

const RECENT_ITEMS_LIMIT = 5;
const ATTENTION_ITEMS_LIMIT = 10;

const formatMoney = (amount: number | string | null | undefined): string =>
  Number(amount ?? 0).toFixed(2);

export const getAdminDashboardStats = async () => {
  const [
    totalUsers,
    customers,
    sellers,
    admins,
    totalSellerProfiles,
    activeSellerProfiles,
    totalProducts,
    activeProducts,
    inactiveProducts,
    outOfStockProducts,
    totalOrders,
    pendingOrders,
    paidOrders,
    completedOrders,
    cancelledOrders,
    paidRevenue,
    completedRevenue,
    recentUsers,
    recentProducts,
    recentOrders,
    productsOutOfStock,
    inactiveProductList,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { role: 'customer' } }),
    User.count({ where: { role: 'seller' } }),
    User.count({ where: { role: 'admin' } }),

    SellerProfile.count(),
    SellerProfile.count({ where: { isActive: true } }),

    Product.count(),
    Product.count({ where: { isActive: true } }),
    Product.count({ where: { isActive: false } }),
    Product.count({ where: { isActive: true, stock: 0 } }),

    Order.count(),
    Order.count({ where: { status: 'pending' } }),
    Order.count({ where: { status: 'paid' } }),
    Order.count({ where: { status: 'completed' } }),
    Order.count({ where: { status: 'cancelled' } }),

    Order.sum('total', { where: { status: 'paid' } }),
    Order.sum('total', { where: { status: 'completed' } }),

    User.findAll({
      attributes: ['id', 'fullName', 'email', 'role', [col('User.created_at'), 'createdAt']],
      order: [[col('User.created_at'), 'DESC']],
      limit: RECENT_ITEMS_LIMIT,
    }),

    Product.findAll({
      attributes: [
        'id',
        'cardId',
        'sellerProfileId',
        'price',
        'stock',
        'isActive',
        [col('Product.created_at'), 'createdAt'],
      ],
      order: [[col('Product.created_at'), 'DESC']],
      limit: RECENT_ITEMS_LIMIT,
    }),

    Order.findAll({
      attributes: ['id', 'userId', 'status', 'total', [col('Order.created_at'), 'createdAt']],
      order: [[col('Order.created_at'), 'DESC']],
      limit: RECENT_ITEMS_LIMIT,
    }),

    Product.findAll({
      attributes: [
        'id',
        'cardId',
        'sellerProfileId',
        'price',
        'stock',
        'isActive',
        [col('Product.created_at'), 'createdAt'],
      ],
      where: { isActive: true, stock: 0 },
      order: [[col('Product.created_at'), 'DESC']],
      limit: ATTENTION_ITEMS_LIMIT,
    }),

    Product.findAll({
      attributes: [
        'id',
        'cardId',
        'sellerProfileId',
        'price',
        'stock',
        'isActive',
        [col('Product.created_at'), 'createdAt'],
      ],
      where: { isActive: false },
      order: [[col('Product.created_at'), 'DESC']],
      limit: ATTENTION_ITEMS_LIMIT,
    }),
  ]);

  const paidAmount = Number(paidRevenue ?? 0);
  const completedAmount = Number(completedRevenue ?? 0);

  // Sumamos en céntimos para evitar errores de precisión con decimales.
  const confirmedRevenueInCents = Math.round(paidAmount * 100) + Math.round(completedAmount * 100);

  return {
    users: {
      total: totalUsers,
      customers,
      sellers,
      admins,
    },

    sellerProfiles: {
      total: totalSellerProfiles,
      active: activeSellerProfiles,
      inactive: totalSellerProfiles - activeSellerProfiles,
    },

    products: {
      total: totalProducts,
      active: activeProducts,
      inactive: inactiveProducts,
      outOfStock: outOfStockProducts,
    },

    orders: {
      total: totalOrders,
      pending: pendingOrders,
      paid: paidOrders,
      completed: completedOrders,
      cancelled: cancelledOrders,
    },

    recentActivity: {
      users: recentUsers,
      products: recentProducts,
      orders: recentOrders,
    },

    revenue: {
      paid: formatMoney(paidAmount),
      completed: formatMoney(completedAmount),
      confirmedTotal: (confirmedRevenueInCents / 100).toFixed(2),
      currency: 'EUR',
    },

    productsRequiringAttention: {
      outOfStock: {
        total: outOfStockProducts,
        items: productsOutOfStock,
      },
      inactive: {
        total: inactiveProducts,
        items: inactiveProductList,
      },
    },

    generatedAt: new Date().toISOString(),
  };
};
