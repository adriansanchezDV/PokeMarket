import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import app from '../../../src/app.js';
import { Notification, Order, OrderItem } from '../../../src/models/indexModel.js';
import sequelize from '../../helpers/testDatabase.js';
import { createPurchase, payPurchase, prepareCheckout } from '../../helpers/purchase.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { withOrderRowLock } from '../../helpers/orderConcurrency.js';

describe('Order concurrency with bounded PostgreSQL row locks', () => {
  it('lets only one buyer pay for the last unit without negative stock', async () => {
    const product = await createProduct({ stock: 1 });
    const first = await createPurchase({ products: [{ product, quantity: 1 }] });
    const second = await createPurchase({ products: [{ product, quantity: 1 }] });
    const responses = await withOrderRowLock('products', product.id, async (gate) => {
      gate.start(
        request(app)
          .post(`/api/orders/${first.order.id}/pay`)
          .set('Authorization', 'Bearer ' + first.token),
      );
      await gate.waitForBlocked(1);
      gate.start(
        request(app)
          .post(`/api/orders/${second.order.id}/pay`)
          .set('Authorization', 'Bearer ' + second.token),
      );
      await gate.waitForBlocked(2);
    });
    expect(responses.map((r) => r.status)).toEqual([200, 409]);
    expect(responses[1].body).toEqual({ error: `Insufficient stock for product ${product.id}` });
    expect((await product.reload()).stock).toBe(0);
    expect((await first.order.reload()).status).toBe('paid');
    expect((await second.order.reload()).status).toBe('pending');
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(1);
  }, 15_000);

  it('serializes two payments of the same order with exactly one decrement and sale', async () => {
    const purchase = await createPurchase();
    const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
      for (let count = 1; count <= 2; count++) {
        gate.start(
          request(app)
            .post(`/api/orders/${purchase.order.id}/pay`)
            .set('Authorization', 'Bearer ' + purchase.token),
        );
        await gate.waitForBlocked(count);
      }
    });
    expect(responses.map((r) => r.status)).toEqual([200, 409]);
    expect((await purchase.products[0].product.reload()).stock).toBe(2);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(1);
  }, 15_000);

  it('serializes paid cancellations with exactly one stock restoration', async () => {
    const purchase = await payPurchase(await createPurchase());
    const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
      for (let count = 1; count <= 2; count++) {
        gate.start(
          request(app)
            .post(`/api/orders/${purchase.order.id}/cancel`)
            .set('Authorization', 'Bearer ' + purchase.token),
        );
        await gate.waitForBlocked(count);
      }
    });
    expect(responses.map((r) => r.status)).toEqual([200, 409]);
    expect((await purchase.products[0].product.reload()).stock).toBe(3);
    expect((await purchase.order.reload()).status).toBe('cancelled');
    expect(await Notification.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(1);
  }, 15_000);

  it.each(['pay', 'cancel'] as const)(
    'orders payment/cancellation with %s queued first',
    async (first) => {
      const purchase = await createPurchase();
      const operations = first === 'pay' ? ['pay', 'cancel'] : ['cancel', 'pay'];
      const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
        for (const [index, operation] of operations.entries()) {
          gate.start(
            request(app)
              .post(`/api/orders/${purchase.order.id}/${operation}`)
              .set('Authorization', 'Bearer ' + purchase.token),
          );
          await gate.waitForBlocked(index + 1);
        }
      });
      expect(responses.map((r) => r.status)).toEqual(first === 'pay' ? [200, 200] : [200, 409]);
      expect((await purchase.order.reload()).status).toBe('cancelled');
      expect((await purchase.products[0].product.reload()).stock).toBe(3);
      expect(await Notification.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(1);
      expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(
        first === 'pay' ? 1 : 0,
      );
    },
    15_000,
  );

  it.each(['ship', 'cancel'] as const)(
    'orders shipping/cancellation with %s queued first',
    async (first) => {
      const seller = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: seller.profile.id });
      const purchase = await payPurchase(
        await createPurchase({ products: [{ product, quantity: 1 }] }),
      );
      const operations = first === 'ship' ? ['ship', 'cancel'] : ['cancel', 'ship'];
      const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
        for (const [index, operation] of operations.entries()) {
          gate.start(
            operation === 'ship'
              ? request(app)
                  .patch(`/api/seller/orders/${purchase.orderItems[0].id}/status`)
                  .set('Authorization', 'Bearer ' + seller.token)
                  .send({ status: 'shipped' })
              : request(app)
                  .post(`/api/orders/${purchase.order.id}/cancel`)
                  .set('Authorization', 'Bearer ' + purchase.token),
          );
          await gate.waitForBlocked(index + 1);
        }
      });
      expect(responses.map((r) => r.status)).toEqual([200, 409]);
      expect((await purchase.order.reload()).status).toBe(first === 'ship' ? 'paid' : 'cancelled');
      expect((await product.reload()).stock).toBe(first === 'ship' ? 2 : 3);
      expect(await Notification.count({ where: { type: 'ORDER_SHIPPED' } })).toBe(
        first === 'ship' ? 1 : 0,
      );
      expect(await Notification.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(
        first === 'cancel' ? 1 : 0,
      );
    },
    15_000,
  );

  it('serializes duplicate shipping and creates a single buyer notification', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const purchase = await payPurchase(
      await createPurchase({ products: [{ product, quantity: 1 }] }),
    );
    const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
      for (let count = 1; count <= 2; count++) {
        gate.start(
          request(app)
            .patch(`/api/seller/orders/${purchase.orderItems[0].id}/status`)
            .set('Authorization', 'Bearer ' + seller.token)
            .send({ status: 'shipped' }),
        );
        await gate.waitForBlocked(count);
      }
    });
    expect(responses.map((r) => r.status)).toEqual([200, 409]);
    expect(await Notification.count({ where: { type: 'ORDER_SHIPPED' } })).toBe(1);
  }, 15_000);

  it('completes a multi-seller order when its last two deliveries contend', async () => {
    const sellers = [await createSellerWithProfile(), await createSellerWithProfile()];
    const products = [
      await createProduct({ sellerProfileId: sellers[0].profile.id }),
      await createProduct({ sellerProfileId: sellers[1].profile.id }),
    ];
    const purchase = await payPurchase(
      await createPurchase({ products: products.map((product) => ({ product, quantity: 1 })) }),
    );
    for (const [index, seller] of sellers.entries())
      await request(app)
        .patch(`/api/seller/orders/${purchase.orderItems[index].id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status: 'shipped' })
        .expect(200);
    const responses = await withOrderRowLock('orders', purchase.order.id, async (gate) => {
      for (const [index, seller] of sellers.entries()) {
        gate.start(
          request(app)
            .patch(`/api/seller/orders/${purchase.orderItems[index].id}/status`)
            .set('Authorization', 'Bearer ' + seller.token)
            .send({ status: 'delivered' }),
        );
        await gate.waitForBlocked(index + 1);
      }
    });
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect((await purchase.order.reload()).status).toBe('completed');
    expect(await OrderItem.count({ where: { status: 'delivered' } })).toBe(2);
    expect(await Notification.count({ where: { type: 'ORDER_DELIVERED' } })).toBe(2);
  }, 15_000);

  it('consumes a cart only once when two checkouts read it before the seller lock is released', async () => {
    const checkout = await prepareCheckout();
    const product = checkout.products[0].product;
    const responses = await withOrderRowLock(
      'seller_profiles',
      product.sellerProfileId,
      async (gate) => {
        for (let count = 1; count <= 2; count++) {
          gate.start(
            request(app)
              .post('/api/orders')
              .set('Authorization', 'Bearer ' + checkout.token)
              .send({ shippingAddressId: checkout.address.id }),
          );
          await gate.waitForBlocked(count);
        }
      },
    );
    const persisted = await Order.count({ where: { userId: checkout.user.id } });
    expect({ statuses: responses.map((r) => r.status), orders: persisted }).toEqual({
      statuses: [201, 409],
      orders: 1,
    });
  }, 15_000);

  it.each(['stock', 'price'] as const)(
    'uses committed %s after waiting for a concurrent product update',
    async (field) => {
      const checkout = await prepareCheckout();
      const product = checkout.products[0].product;
      const responses = await withOrderRowLock('products', product.id, async (gate) => {
        gate.start(
          request(app)
            .post('/api/orders')
            .set('Authorization', 'Bearer ' + checkout.token)
            .send({ shippingAddressId: checkout.address.id }),
        );
        await gate.waitForBlocked(1);
        await gate.changeProduct(field === 'stock' ? { stock: 0 } : { price: 30 });
      });
      if (field === 'stock') {
        expect({ status: responses[0].status, orders: await Order.count() }).toEqual({
          status: 409,
          orders: 0,
        });
      } else {
        expect(responses[0].status).toBe(201);
        const order = await Order.findByPk(responses[0].body.id);
        expect({ committedPrice: (await product.reload()).price, snapshot: order?.total }).toEqual({
          committedPrice: '30.00',
          snapshot: '30.00',
        });
      }
    },
    15_000,
  );

  it('releases the blocker and drains HTTP work even when the exercise callback throws', async () => {
    const purchase = await createPurchase();
    await expect(
      withOrderRowLock('orders', purchase.order.id, async (gate) => {
        gate.start(
          request(app)
            .post(`/api/orders/${purchase.order.id}/pay`)
            .set('Authorization', 'Bearer ' + purchase.token),
        );
        await gate.waitForBlocked(1);
        throw new Error('Deliberate concurrency-test failure');
      }),
    ).rejects.toThrow('Deliberate concurrency-test failure');
    expect((await purchase.order.reload()).status).toBe('paid');
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query('SELECT id FROM public.orders WHERE id = :id FOR UPDATE NOWAIT', {
        replacements: { id: purchase.order.id },
        transaction,
        type: QueryTypes.SELECT,
      });
    } finally {
      await transaction.rollback();
    }
    const active = await sequelize.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=current_database() AND application_name='pokemarket-test-http'",
      { type: QueryTypes.SELECT },
    );
    expect(active[0].count).toBe('0');
  }, 15_000);
});
