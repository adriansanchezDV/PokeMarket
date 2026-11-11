import request from 'supertest';
import app from '../../src/app.js';
import { Order, OrderItem, type Product, type User } from '../../src/models/indexModel.js';
import { createCart } from '../factories/cartFactory.js';
import { createProduct } from '../factories/productFactory.js';
import { createShippingAddress } from '../factories/shippingAddressFactory.js';

export const prepareCheckout = async (
  options: { user?: User; products?: { product: Product; quantity: number }[] } = {},
) => {
  const products = options.products ?? [{ product: await createProduct(), quantity: 1 }];
  const cart = await createCart({ user: options.user, products });
  const address = await createShippingAddress(cart.user.id);
  return { ...cart, address, products };
};

export const createPurchase = async (options: Parameters<typeof prepareCheckout>[0] = {}) => {
  const checkout = await prepareCheckout(options);
  const response = await request(app)
    .post('/api/orders')
    .set('Authorization', 'Bearer ' + checkout.token)
    .send({ shippingAddressId: checkout.address.id })
    .expect(201);
  const order = await Order.findByPk(response.body.id);
  if (!order) throw new Error('HTTP checkout did not persist an order');
  const items = await OrderItem.findAll({ where: { orderId: order.id }, order: [['id', 'ASC']] });
  return { ...checkout, order, orderItems: items };
};

export const payPurchase = async (purchase: Awaited<ReturnType<typeof createPurchase>>) => {
  await request(app)
    .post(`/api/orders/${purchase.order.id}/pay`)
    .set('Authorization', 'Bearer ' + purchase.token)
    .expect(200);
  return purchase;
};
