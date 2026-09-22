import { Op, type WhereOptions } from 'sequelize';
import Card from '../models/CardModel.js';

type CardFilters = {
  name?: string;
  setId?: number;
  rarity?: string;
  category?: string;
};

export const getAllCards = async (filters: CardFilters = {}, page = 1, limit = 20) => {
  const where: WhereOptions = {};

  if (filters.name) {
    where.name = {
      [Op.iLike]: `%${filters.name}%`,
    };
  }

  if (filters.setId !== undefined) {
    where.setId = filters.setId;
  }

  if (filters.rarity) {
    where.rarity = filters.rarity;
  }

  if (filters.category) {
    where.category = filters.category;
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
  return Card.findByPk(id);
};
