import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Notification, OrderItem } from '../../../src/models/indexModel.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createPurchase, payPurchase } from '../../helpers/purchase.js';
import { shippingAddressSnapshot } from '../../factories/shippingAddressFactory.js';
import { failTransactionAt } from '../../helpers/transactionFailure.js';

const prepare = async (paid = true) => {
  const seller = await createSellerWithProfile();
  const product = await createProduct({ sellerProfileId: seller.profile.id });
  const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
  if (paid) await payPurchase(purchase);
  return { seller, product, purchase, item: purchase.orderItems[0] };
};

describe('Seller orders', () => {
  it('lists only own order lines and their immutable shipping information', async () => {
    const { seller, product, purchase, item } = await prepare();
    const otherSeller = await createSellerWithProfile();
    const otherProduct = await createProduct({ sellerProfileId: otherSeller.profile.id });
    const later = await payPurchase(
      await createPurchase({
        products: [
          { product: otherProduct, quantity: 1 },
          { product, quantity: 1 },
        ],
      }),
    );
    await item.update({ created_at: new Date('2020-01-01') });
    const response = await request(app)
      .get('/api/seller/orders')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    expect(response.body.map((i: { id: number }) => i.id)).toEqual([
      later.orderItems.find((line) => line.productId === product.id)!.id,
      item.id,
    ]);
    expect(
      response.body.every(
        (i: { sellerProfileId: number }) => i.sellerProfileId === seller.profile.id,
      ),
    ).toBe(true);
    expect(response.body[1].order).toMatchObject({
      id: purchase.order.id,
      status: 'paid',
      shippingAddress: shippingAddressSnapshot,
    });
    const other = await request(app)
      .get('/api/seller/orders')
      .set('Authorization', 'Bearer ' + otherSeller.token)
      .expect(200);
    expect(other.body.map((i: { id: number }) => i.id)).toEqual([
      later.orderItems.find((line) => line.productId === otherProduct.id)!.id,
    ]);
  });

  it('ships, delivers and completes a one-line order, notifying the buyer exactly once per transition', async () => {
    const { seller, product, purchase, item } = await prepare();
    const shipped = await request(app)
      .patch(`/api/seller/orders/${item.id}/status`)
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ status: 'shipped' })
      .expect(200);
    expect(shipped.body.status).toBe('paid');
    expect((await item.reload()).status).toBe('shipped');
    const delivered = await request(app)
      .patch(`/api/seller/orders/${item.id}/status`)
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ status: 'delivered' })
      .expect(200);
    expect(delivered.body.status).toBe('completed');
    expect((await purchase.order.reload()).status).toBe('completed');
    expect((await item.reload()).status).toBe('delivered');
    const notifications = await Notification.findAll({ where: { userId: purchase.user.id } });
    expect(notifications.map((n) => n.type).sort()).toEqual(['ORDER_DELIVERED', 'ORDER_SHIPPED']);
    expect((await product.reload()).stock).toBe(2);
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    expect((await product.reload()).stock).toBe(2);
  });

  it('completes a multi-seller order only after all lines have been delivered', async () => {
    const firstSeller = await createSellerWithProfile();
    const secondSeller = await createSellerWithProfile();
    const first = await createProduct({ sellerProfileId: firstSeller.profile.id });
    const second = await createProduct({ sellerProfileId: secondSeller.profile.id });
    const purchase = await payPurchase(
      await createPurchase({
        products: [
          { product: first, quantity: 1 },
          { product: second, quantity: 1 },
        ],
      }),
    );
    for (const [index, seller] of [firstSeller, secondSeller].entries()) {
      const item = purchase.orderItems[index];
      await request(app)
        .patch(`/api/seller/orders/${item.id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status: 'shipped' })
        .expect(200);
      await request(app)
        .patch(`/api/seller/orders/${item.id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status: 'delivered' })
        .expect(200);
      expect((await purchase.order.reload()).status).toBe(index === 0 ? 'paid' : 'completed');
      if (index === 0) expect((await purchase.orderItems[1].reload()).status).toBe('processing');
    }
    expect(
      await OrderItem.count({ where: { orderId: purchase.order.id, status: 'delivered' } }),
    ).toBe(2);
    expect(
      await Notification.count({ where: { userId: purchase.user.id, type: 'ORDER_DELIVERED' } }),
    ).toBe(2);
  });

  it('preserves shipping and delivery operations for inactive sellers and inactive/deleted products', async () => {
    const { seller, product, purchase, item } = await prepare();
    await seller.profile.update({ isActive: false });
    await product.update({ isActive: false });
    await request(app)
      .get('/api/seller/orders')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    await request(app)
      .patch(`/api/seller/orders/${item.id}/status`)
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ status: 'shipped' })
      .expect(200);
    await product.destroy();
    await request(app)
      .patch(`/api/seller/orders/${item.id}/status`)
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ status: 'delivered' })
      .expect(200);
    expect((await purchase.order.reload()).status).toBe('completed');
    expect((await item.reload()).toJSON()).toMatchObject({
      productId: null,
      productName: 'Charizard',
      status: 'delivered',
    });
  });

  it.each([
    ['pending', 'shipped'],
    ['processing', 'delivered'],
    ['shipped', 'shipped'],
    ['delivered', 'shipped'],
    ['delivered', 'delivered'],
    ['cancelled', 'shipped'],
  ] as const)(
    'rejects %s to %s without changing stock or generating notifications',
    async (initial, next) => {
      const { seller, product, purchase, item } = await prepare(
        initial !== 'pending' && initial !== 'cancelled',
      );
      if (initial === 'cancelled')
        await request(app)
          .post(`/api/orders/${purchase.order.id}/cancel`)
          .set('Authorization', 'Bearer ' + purchase.token)
          .expect(200);
      if (initial === 'shipped' || initial === 'delivered')
        await request(app)
          .patch(`/api/seller/orders/${item.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status: 'shipped' })
          .expect(200);
      if (initial === 'delivered')
        await request(app)
          .patch(`/api/seller/orders/${item.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status: 'delivered' })
          .expect(200);
      const count = await Notification.count();
      const stock = (await product.reload()).stock;
      const response = await request(app)
        .patch(`/api/seller/orders/${item.id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status: next })
        .expect(409);
      expect(response.body).toEqual({
        error: `Invalid status transition from ${initial} to ${next}`,
      });
      expect((await item.reload()).status).toBe(initial);
      expect((await product.reload()).stock).toBe(stock);
      expect(await Notification.count()).toBe(count);
    },
  );

  it.each(['shipped', 'delivered'] as const)(
    'rolls back %s and its notification when PostgreSQL fails',
    async (status) => {
      const { seller, purchase, item } = await prepare();
      if (status === 'delivered')
        await request(app)
          .patch(`/api/seller/orders/${item.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status: 'shipped' })
          .expect(200);
      const before = await Notification.count();
      const failure = failTransactionAt('notification');
      try {
        await request(app)
          .patch(`/api/seller/orders/${item.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status })
          .expect(500);
        expect(failure.state.calls).toBe(1);
        expect(failure.state.transactionId).not.toBe('');
      } finally {
        failure.remove();
      }
      expect((await item.reload()).status).toBe(status === 'shipped' ? 'processing' : 'shipped');
      expect((await purchase.order.reload()).status).toBe('paid');
      expect(await Notification.count()).toBe(before);
    },
  );

  it('rejects foreign and missing lines and never changes another seller data', async () => {
    const { purchase, item } = await prepare();
    const other = await createSellerWithProfile();
    for (const id of [item.id, 999999]) {
      const response = await request(app)
        .patch(`/api/seller/orders/${id}/status`)
        .set('Authorization', 'Bearer ' + other.token)
        .send({ status: 'shipped' })
        .expect(404);
      expect(response.body).toEqual({ error: 'Order item not found' });
    }
    expect((await item.reload()).status).toBe('processing');
    expect((await purchase.order.reload()).status).toBe('paid');
    expect(await Notification.count({ where: { type: 'ORDER_SHIPPED' } })).toBe(0);
  });

  it('returns empty own listings and 404 when the account has no seller profile', async () => {
    const { token } = await createSellerWithProfile();
    const empty = await request(app)
      .get('/api/seller/orders')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(empty.body).toEqual([]);
    const noProfile = createToken(await createUser({ role: 'seller' }));
    await request(app)
      .get('/api/seller/orders')
      .set('Authorization', 'Bearer ' + noProfile)
      .expect(404);
    const response = await request(app)
      .patch('/api/seller/orders/1/status')
      .set('Authorization', 'Bearer ' + noProfile)
      .send({ status: 'shipped' })
      .expect(404);
    expect(response.body).toEqual({ error: 'Seller profile not found' });
  });

  it.each(['pending', 'processing', 'cancelled', 'invalid', null])(
    'rejects invalid status payload %s before any write',
    async (status) => {
      const { seller, item } = await prepare();
      await request(app)
        .patch(`/api/seller/orders/${item.id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status })
        .expect(400);
      expect((await item.reload()).status).toBe('processing');
    },
  );

  it('rejects malformed line IDs', async () => {
    const { token } = await createSellerWithProfile();
    for (const id of ['abc', '0', '-1', '1.5']) {
      const response = await request(app)
        .patch(`/api/seller/orders/${id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ status: 'shipped' })
        .expect(400);
      expect(response.body).toEqual({ error: 'Invalid order item id' });
    }
  });

  it.each(['get', 'patch'] as const)(
    'protects %s against anonymous, non-seller and banned accounts',
    async (method) => {
      const path = '/api/seller/orders' + (method === 'patch' ? '/1/status' : '');
      await request(app)[method](path).send({ status: 'shipped' }).expect(401);
      for (const role of ['customer', 'admin'] as const) {
        const token = createToken(await createUser({ role }));
        await request(app)
          [method](path)
          .set('Authorization', 'Bearer ' + token)
          .send({ status: 'shipped' })
          .expect(403);
      }
      const banned = await createSellerWithProfile({ user: { isBanned: true } });
      await request(app)
        [method](path)
        .set('Authorization', 'Bearer ' + banned.token)
        .send({ status: 'shipped' })
        .expect(403);
    },
  );
});
