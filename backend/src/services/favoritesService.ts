import Favorite from '../models/FavoriteModel.js';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';
import { col } from 'sequelize';

export const getUserFavorites = async (userId: number) => {
  return Favorite.findAll({
    where: {
      userId,
    },
    include: [
      {
        model: Product,
        as: 'product',
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
      },
    ],
    order: [[col('Favorite.created_at'), 'DESC']],
  });
};

export const addFavorite = async (userId: number, productId: number) => {
  const product = await Product.findByPk(productId);

  if (!product) {
    throw new Error('Product not found');
  }

  const existingFavorite = await Favorite.findOne({
    where: {
      userId,
      productId,
    },
  });

  if (existingFavorite) {
    throw new Error('Product already in favorites');
  }

  return Favorite.create({
    userId,
    productId,
  });
};

export const removeFavorite = async (userId: number, productId: number) => {
  const favorite = await Favorite.findOne({
    where: {
      userId,
      productId,
    },
  });

  if (!favorite) {
    return false;
  }

  await favorite.destroy();

  return true;
};
