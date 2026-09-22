import Cart from '../models/CartModel.js';
import CartItem from '../models/CartItemModel.js';
import Product from '../models/ProductModel.js';
import Card from '../models/CardModel.js';
import SellerProfile from '../models/SellerProfileModel.js';

export const getOrCreateCart = async (userId: number) => {
  let cart = await Cart.findOne({
    where: { userId },
  });

  if (!cart) {
    cart = await Cart.create({ userId });
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
                attributes: ['id', 'storeName'],
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

  return cart;
};

export const addItemToCart = async (userId: number, productId: number) => {
  const product = await Product.findByPk(productId);

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.stock <= 0) {
    throw new Error('Product out of stock');
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = await CartItem.findOne({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + 1;

    if (newQuantity > product.stock) {
      throw new Error('Insufficient stock');
    }

    existingItem.quantity = newQuantity;
    await existingItem.save();

    return existingItem;
  }

  return CartItem.create({
    cartId: cart.id,
    productId,
    quantity: 1,
  });
};

export const updateCartItem = async (userId: number, productId: number, quantity: number) => {
  const cart = await Cart.findOne({
    where: { userId },
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  const item = await CartItem.findOne({
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
    throw new Error('Cart item not found');
  }

  const product = item.get('product') as Product;

  if (quantity > product.stock) {
    throw new Error('Insufficient stock');
  }

  item.quantity = quantity;
  await item.save();

  return item;
};

export const removeItemFromCart = async (userId: number, productId: number) => {
  const cart = await Cart.findOne({
    where: { userId },
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  const item = await CartItem.findOne({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  if (!item) {
    throw new Error('Cart item not found');
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
