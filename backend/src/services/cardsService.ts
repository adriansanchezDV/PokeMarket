import { Op, type WhereOptions } from 'sequelize';
import Card from '../models/CardModel.js';
import Set from '../models/SetModel.js';
import Product from '../models/ProductModel.js';
import SellerProfile from '../models/SellerProfileModel.js';

type CardFilters = {
  search?: string;
  setId?: number;
  rarity?: string;
  category?: string;
  number?: string;
  artist?: string;
  type?: string;
  minHp?: number;
  maxHp?: number;
};

export const getAllCards = async (filters: CardFilters = {}, page = 1, limit = 20) => {
  const where: WhereOptions = {
    ...(filters.search
      ? {
          [Op.or]: [
            {
              name: {
                [Op.iLike]: `%${filters.search}%`,
              },
            },
            {
              number: {
                [Op.iLike]: `%${filters.search}%`,
              },
            },
            {
              artist: {
                [Op.iLike]: `%${filters.search}%`,
              },
            },
            {
              description: {
                [Op.iLike]: `%${filters.search}%`,
              },
            },
          ],
        }
      : {}),
  };

  if (filters.setId !== undefined) {
    where.setId = filters.setId;
  }

  if (filters.rarity) {
    where.rarity = filters.rarity;
  }

  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.number) {
    where.number = {
      [Op.iLike]: `%${filters.number}%`,
    };
  }

  if (filters.artist) {
    where.artist = {
      [Op.iLike]: `%${filters.artist}%`,
    };
  }

  if (filters.type) {
    where.types = {
      [Op.contains]: [filters.type],
    };
  }

  if (filters.minHp !== undefined && filters.maxHp !== undefined) {
    where.hp = {
      [Op.between]: [filters.minHp, filters.maxHp],
    };
  } else if (filters.minHp !== undefined) {
    where.hp = {
      [Op.gte]: filters.minHp,
    };
  } else if (filters.maxHp !== undefined) {
    where.hp = {
      [Op.lte]: filters.maxHp,
    };
  }

  const offset = (page - 1) * limit;

  const { rows, count } = await Card.findAndCountAll({
    where,
    order: [['id', 'ASC']],
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

export const getCardById = async (id: number) => {
  const card = await Card.findByPk(id, {
    include: [
      {
        model: Set,
        as: 'cardSet',
      },
      {
        model: Product,
        as: 'products',
        where: {
          isActive: true,
          stock: {
            [Op.gt]: 0,
          },
        },
        required: false,
        include: [
          {
            model: SellerProfile,
            as: 'sellerProfile',
          },
        ],
      },
    ],
  });

  if (!card) {
    return null;
  }

  const cardData = card.toJSON();

  return {
    id: cardData.id,
    tcgdexId: cardData.tcgdexId,
    name: cardData.name,
    number: cardData.number,
    rarity: cardData.rarity,
    imageUrl: cardData.imageUrl,
    category: cardData.category,
    hp: cardData.hp,
    artist: cardData.artist,
    description: cardData.description,
    types: cardData.types,

    set: {
      id: cardData.cardSet.id,
      tcgdexId: cardData.cardSet.tcgdexId,
      name: cardData.cardSet.name,
      series: cardData.cardSet.series,
      releaseDate: cardData.cardSet.releaseDate,
      totalCards: cardData.cardSet.totalCards,
      logoUrl: cardData.cardSet.logoUrl,
      symbolUrl: cardData.cardSet.symbolUrl,
    },

    products: cardData.products
      .sort((a: Product, b: Product) => Number(a.price) - Number(b.price))
      .map((product: Product) => {
  if (!product.sellerProfile) {
    throw new Error(`Seller profile not found for product ${product.id}`);
  }

  return {
    id: product.id,
    condition: product.condition,
    language: product.language,
    price: product.price,
    stock: product.stock,
    description: product.description,

    seller: {
      id: product.sellerProfile.id,
      storeName: product.sellerProfile.storeName,
      description: product.sellerProfile.description,
    },
  };
})
  };
};