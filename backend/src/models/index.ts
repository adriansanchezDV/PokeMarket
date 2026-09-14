import User from './User.js';
import SellerProfile from './SellerProfile.js';
import Set from './Set.js';
import Card from './Card.js';
import Product from './Product.js';
import Cart from './Cart.js';
import CartItem from './CartItem.js';
import Order from './Order.js';
import OrderItem from './OrderItem.js';
import Favorite from './Favorite.js';

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
