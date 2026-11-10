import { col, Op } from 'sequelize';
import sequelize from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { requireActiveSellerProfile } from './sellerProfileService.js';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';
import Favorite from '../models/FavoriteModel.js';
import {
  notifyFavoriteUsersAboutPriceDrop,
  notifyFavoriteUsersAboutRestock,
} from './notificationService.js';
import { invalidateCardDetailCache } from './cache/cardsCacheService.js';

export const requireActiveProduct = (product: Pick<Product, 'isActive'>) => {
  if (!product.isActive) {
    throw new AppError(409, 'Product is inactive');
  }
};

export const getAllProducts = async (filters: {
  userId?: number;

  cardId?: number;
  sellerProfileId?: number;
  condition?: string;
  language?: string;
  minPrice?: number;
  maxPrice?: number;

  search?: string;
  setId?: number;
  rarity?: string;
  category?: string;
  number?: string;
  artist?: string;
  type?: string;
  minHp?: number;
  maxHp?: number;

  page: number;
  limit: number;
  sort: 'id' | 'price' | 'stock' | 'createdAt';
  order: 'ASC' | 'DESC';
}) => {
  const {
    userId,
    cardId,
    sellerProfileId,
    condition,
    language,
    minPrice,
    maxPrice,

    search,
    setId,
    rarity,
    category,
    number,
    artist,
    type,
    minHp,
    maxHp,

    page,
    limit,
    sort,
    order,
  } = filters;

  const where: Record<string, unknown> = {
    isActive: true,
  };

  const cardWhere: Record<string | symbol, unknown> = {};

  if (search) {
    cardWhere[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { number: { [Op.iLike]: `%${search}%` } },
      { artist: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (setId !== undefined) cardWhere.setId = setId;
  if (rarity) cardWhere.rarity = rarity;
  if (category) cardWhere.category = category;

  if (number) {
    cardWhere.number = {
      [Op.iLike]: `%${number}%`,
    };
  }

  if (artist) {
    cardWhere.artist = {
      [Op.iLike]: `%${artist}%`,
    };
  }

  if (type) {
    cardWhere.types = {
      [Op.contains]: [type],
    };
  }

  if (minHp !== undefined && maxHp !== undefined) {
    cardWhere.hp = {
      [Op.between]: [minHp, maxHp],
    };
  } else if (minHp !== undefined) {
    cardWhere.hp = {
      [Op.gte]: minHp,
    };
  } else if (maxHp !== undefined) {
    cardWhere.hp = {
      [Op.lte]: maxHp,
    };
  }
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

  const hasCardFilters = Reflect.ownKeys(cardWhere).length > 0;

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
        attributes: [
          'id',
          'name',
          'number',
          'rarity',
          'imageUrl',
          'artist',
          'category',
          'hp',
          'types',
          'setId',
        ],
        where: hasCardFilters ? cardWhere : undefined,
        required: hasCardFilters,
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        where: { isActive: true },
        required: true,
        attributes: ['id', 'storeName', 'description'],
      },
    ],
    order: [[col(sortField[sort]), order]],
    limit,
    offset,
  });

  const favoriteProductIds = new Set<number>();

  if (userId !== undefined && rows.length > 0) {
    const favorites = await Favorite.findAll({
      where: {
        userId,
        productId: rows.map((product) => product.id),
      },
      attributes: ['productId'],
    });

    favorites.forEach((favorite) => {
      favoriteProductIds.add(favorite.productId);
    });
  }

  const data = rows.map((product) => ({
    ...product.toJSON(),
    isFavorite: favoriteProductIds.has(product.id),
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

export const getProductById = async (id: number, userId?: number) => {
  const product = await Product.findByPk(id, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        where: { isActive: true },
        required: true,
        attributes: ['id', 'storeName', 'description'],
      },
    ],
  });

  if (!product) {
    return null;
  }

  let isFavorite = false;

  if (userId !== undefined) {
    const favorite = await Favorite.findOne({
      where: {
        userId,
        productId: id,
      },
    });

    isFavorite = Boolean(favorite);
  }

  return {
    ...product.toJSON(),
    isFavorite,
  };
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
  const product = await sequelize.transaction(async (transaction) => {
    await requireActiveSellerProfile(sellerProfileId, transaction);

    const card = await Card.findByPk(data.cardId, { transaction });

    if (!card) {
      throw new AppError(404, 'Card not found');
    }

    const product = await Product.create(
      {
        sellerProfileId,
        cardId: data.cardId,
        condition: data.condition,
        language: data.language,
        price: data.price,
        stock: data.stock,
        description: data.description ?? null,
      },
      { transaction },
    );

    return product;
  });

  await invalidateCardDetailCache(data.cardId);

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
  const result = await sequelize.transaction(async (transaction) => {
    await requireActiveSellerProfile(sellerProfileId, transaction);

    const product = await Product.findOne({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        id,
        sellerProfileId,
      },
    });

    if (!product) {
      return null;
    }

    const oldStock = product.stock;
    const oldPrice = Number(product.price);

    await product.update(data, { transaction });

    return { product, oldStock, oldPrice };
  });

  if (!result) {
    return null;
  }

  const { product, oldStock, oldPrice } = result;

  await invalidateCardDetailCache(product.cardId);

  const newStock = product.stock;
  const newPrice = Number(product.price);

  if (oldStock === 0 && newStock > 0) {
    await notifyFavoriteUsersAboutRestock(product.id);
  }

  if (newPrice < oldPrice) {
    await notifyFavoriteUsersAboutPriceDrop(product.id, oldPrice, newPrice);
  }

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

export const getSellerProducts = async (userId: number) => {
  const sellerProfile = await SellerProfile.findOne({
    where: { userId },
  });

  if (!sellerProfile) {
    throw new AppError(404, 'Seller profile not found');
  }

  return Product.findAll({
    where: {
      sellerProfileId: sellerProfile.id,
    },
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
    ],
    order: [['created_at', 'DESC']],
  });
};

export const updateProductStatus = async (
  id: number,
  sellerProfileId: number,
  isActive: boolean,
) => {
  const product = await sequelize.transaction(async (transaction) => {
    if (isActive) {
      await requireActiveSellerProfile(sellerProfileId, transaction);
    }

    const product = await Product.findOne({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        id,
        sellerProfileId,
      },
    });

    if (!product) {
      return null;
    }

    await product.update({ isActive }, { transaction });

    return product;
  });

  if (!product) {
    return null;
  }

  await invalidateCardDetailCache(product.cardId);

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
