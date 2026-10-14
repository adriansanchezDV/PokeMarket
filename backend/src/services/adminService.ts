import { col, Op } from 'sequelize';
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

type UserRole = 'customer' | 'seller' | 'admin';

interface GetAdminUsersOptions {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
}

export const getAdminUsers = async ({ page, limit, search, role }: GetAdminUsersOptions) => {
  const where: {
    role?: UserRole;
    [Op.or]?: Array<Record<string, unknown>>;
  } = {};

  if (role) {
    where.role = role;
  }

  const searchTerm = search?.trim();

  if (searchTerm) {
    where[Op.or] = [
      { fullName: { [Op.iLike]: `%${searchTerm}%` } },
      { email: { [Op.iLike]: `%${searchTerm}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await User.findAndCountAll({
    attributes: ['id', 'fullName', 'email', 'role', [col('User.created_at'), 'createdAt']],
    where,
    order: [[col('User.created_at'), 'DESC']],
    limit,
    offset,
  });

  return {
    users: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

export const getAdminUserDetails = async (userId: number) => {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'fullName', 'email', 'role', [col('User.created_at'), 'createdAt']],
    include: [
      {
        model: SellerProfile,
        as: 'sellerProfile',
        required: false,
        attributes: ['id', 'storeName', 'description', 'isActive', 'createdAt'],
        include: [
          {
            model: Product,
            as: 'products',
            required: false,
            attributes: [],
          },
        ],
      },
    ],
  });

  if (!user) {
    return null;
  }

  const result = user.toJSON() as {
    id: number;
    fullName: string | null;
    email: string;
    role: 'customer' | 'seller' | 'admin';
    createdAt: Date;
    sellerProfile?: {
      id: number;
      storeName: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
    } | null;
  };

  if (result.sellerProfile) {
    const sellerProfileId = result.sellerProfile.id;

    const [totalProducts, activeProducts, outOfStockProducts] = await Promise.all([
      Product.count({
        where: { sellerProfileId },
      }),
      Product.count({
        where: { sellerProfileId, isActive: true },
      }),
      Product.count({
        where: { sellerProfileId, isActive: true, stock: 0 },
      }),
    ]);

    return {
      ...result,
      sellerProfile: {
        ...result.sellerProfile,
        products: {
          total: totalProducts,
          active: activeProducts,
          outOfStock: outOfStockProducts,
        },
      },
    };
  }

  return result;
};

export const updateAdminSellerStatus = async (sellerProfileId: number, isActive: boolean) => {
  const sellerProfile = await SellerProfile.findByPk(sellerProfileId);

  if (!sellerProfile) {
    return null;
  }

  if (sellerProfile.isActive === isActive) {
    return {
      sellerProfile,
      changed: false,
    };
  }

  await sellerProfile.update({ isActive });

  return {
    sellerProfile,
    changed: true,
  };
};

export const updateAdminUserBanStatus = async (userId: number, isBanned: boolean) => {
  const user = await User.findByPk(userId);

  if (!user) {
    return null;
  }

  if (user.role === 'admin') {
    return { forbidden: true as const };
  }

  if (user.isBanned === isBanned) {
    return {
      user,
      changed: false,
    };
  }

  await user.update({ isBanned });

  return {
    user,
    changed: true,
  };
};
