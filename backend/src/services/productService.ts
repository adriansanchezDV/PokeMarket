import { col, Op } from 'sequelize';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';

export const getAllProducts = async (filters: {
  cardId?: number;
  sellerProfileId?: number;
  condition?: string;
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
  limit: number;
  sort: 'id' | 'price' | 'stock' | 'createdAt';
  order: 'ASC' | 'DESC';
}) => {
  const {
    cardId,
    sellerProfileId,
    condition,
    language,
    minPrice,
    maxPrice,
    page,
    limit,
    sort,
    order,
  } = filters;

  const where: Record<string, unknown> = {};

  if (cardId !== undefined) {
    where.cardId = cardId;
  }

  if (sellerProfileId !== undefined) {
    where.sellerProfileId = sellerProfileId;
  }

  if (condition !== undefined) {
    where.condition = condition;
  }

  if (language !== undefined) {
    where.language = language;
  }

  if (minPrice !== undefined && maxPrice !== undefined) {
    where.price = {
      [Op.between]: [minPrice, maxPrice],
    };
  } else if (minPrice !== undefined) {
    where.price = {
      [Op.gte]: minPrice,
    };
  } else if (maxPrice !== undefined) {
    where.price = {
      [Op.lte]: maxPrice,
    };
  }

  const offset = (page - 1) * limit;

  const sortField = {
    id: 'Product.id',
    price: 'Product.price',
    stock: 'Product.stock',
    createdAt: 'Product.created_at',
  } as const;

  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'storeName', 'description'],
      },
    ],
    order: [[col(sortField[sort]), order]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

export const getProductById = async (id: number) => {
  return Product.findByPk(id, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'storeName', 'description'],
      },
    ],
  });
};

export const createProduct = async (
  sellerProfileId: number,
  data: {
    cardId: number;
    condition: string;
    language: string;
    price: number;
    stock: number;
    description?: string;
  },
) => {
  const card = await Card.findByPk(data.cardId);

  if (!card) {
    throw new Error('Card not found');
  }

  const product = await Product.create({
    sellerProfileId,
    cardId: data.cardId,
    condition: data.condition,
    language: data.language,
    price: data.price,
    stock: data.stock,
    description: data.description ?? null,
  });

  return Product.findByPk(product.id, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'storeName', 'description'],
      },
    ],
  });
};

export const updateProduct = async (
  id: number,
  sellerProfileId: number,
  data: {
    condition?: string;
    language?: string;
    price?: number;
    stock?: number;
    description?: string;
  },
) => {
  const product = await Product.findOne({
    where: {
      id,
      sellerProfileId,
    },
  });

  if (!product) {
    return null;
  }

  await product.update(data);

  return Product.findByPk(product.id, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'storeName', 'description'],
      },
    ],
  });
};

export const deleteProduct = async (id: number, sellerProfileId: number) => {
  const product = await Product.findOne({
    where: {
      id,
      sellerProfileId,
    },
  });

  if (!product) {
    return false;
  }

  await product.destroy();

  return true;
};
