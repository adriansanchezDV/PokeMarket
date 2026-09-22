import Card from './CardModel.js';
import CartItem from './CartItemModel.js';
import Cart from './CartModel.js';
import Favorite from './FavoriteModel.js';
import OrderItem from './OrderItemModel.js';
import Order from './OrderModel.js';
import Product from './ProductModel.js';
import SellerProfile from './SellerProfileModel.js';
import User from './UserModel.js';
import Set from './SetModel.js';

// User <-> SellerProfile
User.hasOne(SellerProfile, {
  foreignKey: 'userId',
  as: 'sellerProfile',
});

SellerProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Set <-> Card
Set.hasMany(Card, {
  foreignKey: 'setId',
  as: 'cards',
});

Card.belongsTo(Set, {
  foreignKey: 'setId',
  as: 'set',
});

// SellerProfile <-> Product
SellerProfile.hasMany(Product, {
  foreignKey: 'sellerProfileId',
  as: 'products',
});

Product.belongsTo(SellerProfile, {
  foreignKey: 'sellerProfileId',
  as: 'sellerProfile',
});

// Card <-> Product
Card.hasMany(Product, {
  foreignKey: 'cardId',
  as: 'products',
});

Product.belongsTo(Card, {
  foreignKey: 'cardId',
  as: 'card',
});

// User <-> Cart
User.hasOne(Cart, {
  foreignKey: 'userId',
  as: 'cart',
});

Cart.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Cart <-> CartItem
Cart.hasMany(CartItem, {
  foreignKey: 'cartId',
  as: 'items',
});

CartItem.belongsTo(Cart, {
  foreignKey: 'cartId',
  as: 'cart',
});

// Product <-> CartItem
Product.hasMany(CartItem, {
  foreignKey: 'productId',
  as: 'cartItems',
});

CartItem.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

// User <-> Order
User.hasMany(Order, {
  foreignKey: 'userId',
  as: 'orders',
});

Order.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Order <-> OrderItem
Order.hasMany(OrderItem, {
  foreignKey: 'orderId',
  as: 'items',
});

OrderItem.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

// Product <-> OrderItem
Product.hasMany(OrderItem, {
  foreignKey: 'productId',
  as: 'orderItems',
});

OrderItem.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

// User <-> Favorite
User.hasMany(Favorite, {
  foreignKey: 'userId',
  as: 'favorites',
});

Favorite.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Product <-> Favorite
Product.hasMany(Favorite, {
  foreignKey: 'productId',
  as: 'favorites',
});

Favorite.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product',
});

export { User, SellerProfile, Set, Card, Product, Cart, CartItem, Order, OrderItem, Favorite };
