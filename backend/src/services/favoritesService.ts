import Favorite from '../models/FavoriteModel.js';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';
import { col } from 'sequelize';

export const getUserFavorites = async (userId: number) => {
  const favorites = await Favorite.findAll({
    where: {
      userId,
    },
    attributes: ['id', 'productId', [col('Favorite.created_at'), 'createdAt']],
    include: [
      {
        model: Product,
        as: 'product',
        attributes: [
          'id',
          'sellerProfileId',
          'cardId',
          'condition',
          'language',
          'price',
          'stock',
          'isActive',
          'description',
        ],
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

  return favorites.map((favorite) => {
    const data = favorite.toJSON();

    let availability: 'available' | 'out_of_stock' | 'inactive';

    if (!data.product.isActive) {
      availability = 'inactive';
    } else if (data.product.stock <= 0) {
      availability = 'out_of_stock';
    } else {
      availability = 'available';
    }

    return {
      ...data,
      product: {
        ...data.product,
        availability,
      },
    };
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
