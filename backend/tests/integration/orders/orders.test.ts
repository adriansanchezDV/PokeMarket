import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import {
  Card,
  CartItem,
  Notification,
  Order,
  OrderItem,
  SellerProfile,
} from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createCart } from '../../factories/cartFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createOrder } from '../../factories/orderFactory.js';
import { createOrderItem } from '../../factories/orderItemFactory.js';
import {
  createShippingAddress,
  shippingAddressSnapshot,
} from '../../factories/shippingAddressFactory.js';
import { prepareCheckout, createPurchase } from '../../helpers/purchase.js';
import { failTransactionAt } from '../../helpers/transactionFailure.js';

describe('Order creation and queries', () => {
  it('snapshots current prices, products and address, empties the cart and leaves stock untouched', async () => {
    const first = await createProduct({ price: 12.35, stock: 5 });
    const second = await createProduct({ price: 0.1, stock: 5 });
    const checkout = await prepareCheckout({
      products: [
        { product: first, quantity: 2 },
        { product: second, quantity: 3 },
      ],
    });
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + checkout.token)
      .send({
        shippingAddressId: checkout.address.id,
        total: '0.01',
        status: 'paid',
        userId: 999999,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      userId: checkout.user.id,
      status: 'pending',
      total: '25.00',
      shippingAddress: shippingAddressSnapshot,
    });
    const order = await Order.findByPk(response.body.id);
    expect(order?.total).toBe('25.00');
    const items = await OrderItem.findAll({
      where: { orderId: response.body.id },
      order: [['productId', 'ASC']],
    });
    expect(items).toHaveLength(2);
    const seller = await SellerProfile.findByPk(first.sellerProfileId);
    expect(items[0].toJSON()).toMatchObject({
      productId: first.id,
      quantity: 2,
      unitPrice: '12.35',
      productName: 'Charizard',
      sellerProfileId: first.sellerProfileId,
      sellerName: seller!.storeName,
      condition: 'Near Mint',
      language: 'English',
      status: 'pending',
    });
    expect(items[1].toJSON()).toMatchObject({ quantity: 3, unitPrice: '0.10', status: 'pending' });
    expect(await CartItem.count({ where: { cartId: checkout.cart.id } })).toBe(0);
    expect((await first.reload()).stock).toBe(5);
    expect((await second.reload()).stock).toBe(5);
    expect(await Notification.count()).toBe(0);
  });

  it('preserves snapshots after editing or deleting the original address and editing catalog data', async () => {
    const purchase = await createPurchase();
    const product = purchase.products[0].product;
    await purchase.address.update({ street: 'Changed Street' });
    await purchase.address.destroy();
    await product.update({ price: 99, condition: 'Played', language: 'French' });
    await Card.update({ name: 'Renamed Card' }, { where: { id: product.cardId } });
    await SellerProfile.update(
      { storeName: 'Renamed Store' },
      { where: { id: product.sellerProfileId } },
    );
    const response = await request(app)
      .get('/api/orders/' + purchase.order.id)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(response.body.shippingAddress).toEqual(shippingAddressSnapshot);
    expect(response.body.total).toBe('25.00');
    expect(response.body.items[0]).toMatchObject({
      productName: 'Charizard',
      unitPrice: '25.00',
      condition: 'Near Mint',
      language: 'English',
    });
    expect(response.body.items[0].sellerName).not.toBe('Renamed Store');
  });

  it.each(['missing', 'empty'] as const)(
    'rejects a %s cart without creating an order',
    async (state) => {
      const user = await createUser();
      const address = await createShippingAddress(user.id);
      if (state === 'empty') await createCart({ user });
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer ' + createToken(user))
        .send({ shippingAddressId: address.id })
        .expect(state === 'missing' ? 404 : 409);
      expect(response.body.error).toBe(state === 'missing' ? 'Cart not found' : 'Cart is empty');
      expect(await Order.count()).toBe(0);
    },
  );

  it.each(['missing', 'other-user'] as const)(
    'rejects a %s address and preserves the cart',
    async (state) => {
      const checkout = await prepareCheckout();
      const addressId =
        state === 'missing' ? 999999 : (await createShippingAddress((await createUser()).id)).id;
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer ' + checkout.token)
        .send({ shippingAddressId: addressId })
        .expect(404);
      expect(response.body).toEqual({ error: 'Shipping address not found' });
      expect(await Order.count()).toBe(0);
      expect(await CartItem.count()).toBe(1);
    },
  );

  it.each(['inactive-product', 'inactive-seller', 'insufficient-stock'] as const)(
    'rejects %s before checkout and preserves all data',
    async (state) => {
      const checkout = await prepareCheckout();
      const product = checkout.products[0].product;
      if (state === 'inactive-seller')
        await SellerProfile.update({ isActive: false }, { where: { id: product.sellerProfileId } });
      else await product.update(state === 'inactive-product' ? { isActive: false } : { stock: 0 });
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer ' + checkout.token)
        .send({ shippingAddressId: checkout.address.id })
        .expect(state === 'inactive-seller' ? 403 : 409);
      expect(response.body.error).toBe(
        state === 'inactive-seller'
          ? 'Seller profile is inactive'
          : state === 'inactive-product'
            ? 'Product is inactive'
            : `Insufficient stock for product ${product.id}`,
      );
      expect(await Order.count()).toBe(0);
      expect(await OrderItem.count()).toBe(0);
      expect(await CartItem.count()).toBe(1);
    },
  );

  it.each([
    {},
    { shippingAddressId: 0 },
    { shippingAddressId: -1 },
    { shippingAddressId: 1.5 },
    { shippingAddressId: '1' },
  ])('rejects invalid checkout payload %j', async (body) => {
    const token = createToken(await createUser());
    await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + token)
      .send(body)
      .expect(400);
    expect(await Order.count()).toBe(0);
  });

  it('rolls back order and lines if clearing the cart fails inside the transaction', async () => {
    const checkout = await prepareCheckout();
    const failure = failTransactionAt('cart-clear');
    try {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer ' + checkout.token)
        .send({ shippingAddressId: checkout.address.id })
        .expect(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      expect(failure.state).toMatchObject({ calls: 1, orders: 1, items: 1 });
      expect(failure.state.transactionId).not.toBe('');
    } finally {
      failure.remove();
    }
    expect(await Order.count()).toBe(0);
    expect(await OrderItem.count()).toBe(0);
    expect(await CartItem.count()).toBe(1);
    expect((await checkout.products[0].product.reload()).stock).toBe(3);
  });

  it('returns only the current account orders with lines in descending creation order', async () => {
    const user = await createUser();
    const product = await createProduct();
    const first = await createOrder(user.id);
    await first.update({ created_at: new Date('2020-01-01') });
    await createOrderItem(first.id, product);
    const second = await createOrder(user.id);
    await createOrderItem(second.id, product);
    await createOrder((await createUser()).id);
    const token = createToken(user);
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body.map((o: { id: number }) => o.id)).toEqual([second.id, first.id]);
    expect(response.body[0].items).toHaveLength(1);
    const otherToken = createToken(await createUser());
    await request(app)
      .get('/api/orders/' + first.id)
      .set('Authorization', 'Bearer ' + otherToken)
      .expect(404);
    const empty = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer ' + otherToken)
      .expect(200);
    expect(empty.body).toEqual([]);
  });

  it('rejects nonexistent and invalid order IDs', async () => {
    const token = createToken(await createUser());
    await request(app)
      .get('/api/orders/999999')
      .set('Authorization', 'Bearer ' + token)
      .expect(404);
    for (const id of ['abc', '0', '-1', '1.5'])
      await request(app)
        .get('/api/orders/' + id)
        .set('Authorization', 'Bearer ' + token)
        .expect(400);
  });

  it.each(['list', 'get', 'create'] as const)(
    'requires authentication for %s orders',
    async (operation) => {
      const path = '/api/orders' + (operation === 'get' ? '/1' : '');
      const method = operation === 'create' ? 'post' : 'get';
      await request(app)[method](path).send({ shippingAddressId: 1 }).expect(401);
      const token = createToken(await createUser({ isBanned: true }));
      await request(app)
        [method](path)
        .set('Authorization', 'Bearer ' + token)
        .send({ shippingAddressId: 1 })
        .expect(403);
    },
  );
});
