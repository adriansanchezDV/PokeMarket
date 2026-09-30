import { col, Op } from 'sequelize';

import {
  SellerProfile,
  Product,
  Card,
  OrderItem,
} from '../models/indexModel.js';

const getStoreStats = async (storeId: number) => {
  const [productCount, salesItems] = await Promise.all([
    Product.count({
      where: {
        sellerProfileId: storeId,
        isActive: true,
      },
    }),

    OrderItem.findAll({
      where: {
        sellerProfileId: storeId,
        status: {
          [Op.not]: 'cancelled',
        },
      },
      attributes: ['quantity'],
    }),
  ]);

  const salesCount = salesItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  return {
    productCount,
    salesCount,
  };
};

export const getStores = async () => {
  const stores = await SellerProfile.findAll({
    attributes: [
      'id',
      'storeName',
      'description',
      'isActive',
      'createdAt',
    ],
    order: [['createdAt', 'DESC']],
  });

  return Promise.all(
    stores.map(async (store) => {
      const stats = await getStoreStats(store.id);

      return {
        id: store.id,
        storeName: store.storeName,
        description: store.description,
        isActive: store.isActive,
        createdAt: store.createdAt,
        ...stats,
      };
    }),
  );
};

export const getStoreById = async (storeId: number) => {
  const store = await SellerProfile.findByPk(storeId, {
    attributes: [
      'id',
      'storeName',
      'description',
      'isActive',
      'createdAt',
    ],
  });

  if (!store) {
    return null;
  }

  const stats = await getStoreStats(store.id);

  return {
    id: store.id,
    storeName: store.storeName,
    description: store.description,
    isActive: store.isActive,
    createdAt: store.createdAt,
    ...stats,
  };
};

export const getStoreProducts = async (storeId: number) => {
  const store = await SellerProfile.findByPk(storeId, {
    attributes: ['id'],
  });

  if (!store) {
    return null;
  }

  return Product.findAll({
  where: {
    sellerProfileId: storeId,
    isActive: true,
  },
  attributes: [
    'id',
    'condition',
    'language',
    'price',
    'stock',
    'isActive',
    'description',
    [col('Product.created_at'), 'createdAt'],
  ],
  include: [
    {
      model: Card,
      as: 'card',
      attributes: [
        'id',
        'name',
        'number',
        'rarity',
        'imageUrl',
        'category',
        'hp',
        'artist',
        'types',
      ],
    },
  ],
  order: [[col('Product.created_at'), 'DESC']],
});
};