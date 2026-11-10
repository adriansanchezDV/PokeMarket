import { AppError } from '../utils/AppError.js';
import type { Transaction } from 'sequelize';
import sequelize from '../config/database.js';
import { requireActiveSellerProfile } from './sellerProfileService.js';
import { requireActiveProduct } from './productService.js';
import Cart from '../models/CartModel.js';
import CartItem from '../models/CartItemModel.js';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';

export const getOrCreateCart = async (userId: number, transaction?: Transaction) => {
  let cart = await Cart.findOne({
    where: { userId },
    transaction,
  });

  if (!cart) {
    cart = await Cart.create({ userId }, { transaction });
  }

  return cart;
};

export const getCart = async (userId: number) => {
  const cart = await Cart.findOne({
    where: { userId },
    include: [
      {
        model: CartItem,
        as: 'items',
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
                attributes: ['id', 'storeName', 'isActive'],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!cart) {
    return {
      id: null,
      items: [],
    };
  }

  const items = cart.get('items') as CartItem[];
  return {
    ...cart.toJSON(),
    items: items.map((item) => {
      const product = item.get('product') as Product | null;
      const seller = product?.get('sellerProfile') as SellerProfile | undefined;
      const availability =
        !product?.isActive || !seller?.isActive
          ? 'inactive'
          : product.stock <= 0
            ? 'out_of_stock'
            : 'available';

      return {
        ...item.toJSON(),
        product: product ? { ...product.toJSON(), availability } : null,
      };
    }),
  };
};

export const addItemToCart = async (userId: number, productId: number) => {
  return sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(productId, { transaction });

    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    await requireActiveSellerProfile(product.sellerProfileId, transaction);
    await product.reload({ transaction, lock: transaction.LOCK.UPDATE });
    requireActiveProduct(product);

    if (product.stock <= 0) {
      throw new AppError(409, 'Product out of stock');
    }

    const cart = await getOrCreateCart(userId, transaction);

    const existingItem = await CartItem.findOne({
      transaction,
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;

      if (newQuantity > product.stock) {
        throw new AppError(409, 'Insufficient stock');
      }

      existingItem.quantity = newQuantity;
      await existingItem.save({ transaction });

      return existingItem;
    }

    return CartItem.create(
      {
        cartId: cart.id,
        productId,
        quantity: 1,
      },
      { transaction },
    );
  });
};

export const updateCartItem = async (userId: number, productId: number, quantity: number) => {
  return sequelize.transaction(async (transaction) => {
    const cart = await Cart.findOne({
      transaction,
      where: { userId },
    });

    if (!cart) {
      throw new AppError(404, 'Cart not found');
    }

    const item = await CartItem.findOne({
      transaction,
      where: {
        cartId: cart.id,
        productId,
      },
      include: [
        {
          model: Product,
          as: 'product',
        },
      ],
    });

    if (!item) {
      throw new AppError(404, 'Cart item not found');
    }

    const product = item.get('product') as Product;

    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    if (quantity > item.quantity) {
      await requireActiveSellerProfile(product.sellerProfileId, transaction);
      await product.reload({ transaction, lock: transaction.LOCK.UPDATE });
      requireActiveProduct(product);
    }

    if (quantity > product.stock) {
      throw new AppError(409, 'Insufficient stock');
    }

    item.quantity = quantity;
    await item.save({ transaction });

    return item;
  });
};

export const removeItemFromCart = async (userId: number, productId: number) => {
  const cart = await Cart.findOne({
    where: { userId },
  });

  if (!cart) {
    throw new AppError(404, 'Cart not found');
  }

  const item = await CartItem.findOne({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  if (!item) {
    throw new AppError(404, 'Cart item not found');
  }

  await item.destroy();
};

export const clearCart = async (userId: number) => {
  const cart = await Cart.findOne({
    where: { userId },
  });

  if (!cart) {
    return;
  }

  await CartItem.destroy({
    where: {
      cartId: cart.id,
    },
  });
};
