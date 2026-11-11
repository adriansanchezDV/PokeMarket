import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import app from '../../../src/app.js';
import { OrderItem } from '../../../src/models/indexModel.js';
import sequelize from '../../helpers/testDatabase.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createOrder } from '../../factories/orderFactory.js';
import { createOrderItem } from '../../factories/orderItemFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';

describe('Seller statistics with persisted order lines', () => {
  it('verifies the actual Sequelize timestamp attribute against PostgreSQL before using it', async () => {
    const product = await createProduct();
    const order = await createOrder((await createUser()).id);
    const line = await createOrderItem(order.id, product);
    const attributes = OrderItem.getAttributes();
    expect(attributes.created_at.field).toBe('created_at');
    expect(attributes).not.toHaveProperty('createdAt');
    const [row] = await sequelize.query<{ created_at: Date }>(
      'SELECT created_at FROM public.order_items WHERE id=:id',
      { replacements: { id: line.id }, type: QueryTypes.SELECT },
    );
    expect((await line.reload()).get('created_at')).toEqual(row.created_at);
    expect(row.created_at).toBeInstanceOf(Date);
  });

  it('returns the existing empty statistics structure', async () => {
    const seller = await createSellerWithProfile();
    const response = await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    expect(response.body).toEqual({
      products: { total: 0, active: 0, inactive: 0, outOfStock: 0 },
      orders: { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
      sales: { totalItems: 0, totalRevenue: '0.00', thisMonthItems: 0, thisMonthRevenue: '0.00' },
      recentOrders: [],
    });
  });

  it('counts cancelled lines and includes only paid/completed sales at snapshot prices', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const buyer = await createUser();
    for (const [orderStatus, status] of [
      ['pending', 'pending'],
      ['paid', 'processing'],
      ['paid', 'shipped'],
      ['completed', 'delivered'],
      ['cancelled', 'cancelled'],
    ] as const) {
      const order = await createOrder(buyer.id, { status: orderStatus });
      await createOrderItem(order.id, product, { status, quantity: 2, unitPrice: '10.25' });
    }
    const foreign = await createProduct();
    await createOrderItem((await createOrder(buyer.id, { status: 'paid' })).id, foreign, {
      status: 'processing',
      quantity: 20,
    });
    await product.update({ price: 99 });
    const response = await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    expect(response.body.orders).toEqual({
      pending: 1,
      processing: 1,
      shipped: 1,
      delivered: 1,
      cancelled: 1,
    });
    expect(response.body.sales.totalItems).toBe(6);
    expect(response.body.sales.totalRevenue).toBe('61.50');
    expect(response.body.recentOrders).toHaveLength(5);
  });

  it('does not count inconsistent unpaid or pending historical lines as sales', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const buyer = await createUser();
    await createOrderItem((await createOrder(buyer.id)).id, product, {
      status: 'processing',
      quantity: 3,
    });
    await createOrderItem((await createOrder(buyer.id, { status: 'paid' })).id, product, {
      status: 'pending',
      quantity: 4,
    });
    const response = await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    expect(response.body.sales).toMatchObject({
      totalItems: 0,
      totalRevenue: '0.00',
      thisMonthItems: 0,
      thisMonthRevenue: '0.00',
    });
    expect(response.body.orders).toMatchObject({ processing: 1, pending: 1 });
  });

  it('uses the local creation month with inclusive start, exclusive end and real persisted dates', async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    try {
      const seller = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: seller.profile.id });
      const buyer = await createUser();
      for (const [date, quantity, paid] of [
        [new Date(2026, 9, 31, 23, 59, 59), 2, true],
        [new Date(2026, 10, 1), 3, true],
        [new Date(2026, 10, 15), 4, true],
        [new Date(2026, 11, 1), 5, true],
        [new Date(2026, 10, 10), 10, false],
      ] as const) {
        const order = await createOrder(buyer.id, { status: paid ? 'paid' : 'pending' });
        const item = await createOrderItem(order.id, product, {
          status: paid ? 'processing' : 'pending',
          quantity,
          unitPrice: '2.50',
        });
        await sequelize.query('UPDATE public.order_items SET created_at=:date WHERE id=:id', {
          replacements: { id: item.id, date },
        });
      }
      const response = await request(app)
        .get('/api/seller/stats')
        .set('Authorization', 'Bearer ' + seller.token)
        .expect(200);
      expect(response.body.sales).toEqual({
        totalItems: 14,
        totalRevenue: '35.00',
        thisMonthItems: 7,
        thisMonthRevenue: '17.50',
      });
      expect(response.body.recentOrders[0].createdAt).toBe(new Date(2026, 11, 1).toISOString());
      expect(
        response.body.recentOrders.every(
          (line: { createdAt: string }) => !Number.isNaN(Date.parse(line.createdAt)),
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves product metrics and historical access for an inactive commercial profile', async () => {
    const seller = await createSellerWithProfile({ isActive: false });
    await createProduct({ sellerProfileId: seller.profile.id });
    await createProduct({ sellerProfileId: seller.profile.id, isActive: false, stock: 0 });
    const response = await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
    expect(response.body.products).toEqual({ total: 2, active: 1, inactive: 1, outOfStock: 1 });
  });

  it('requires an authenticated non-banned seller with a profile', async () => {
    await request(app).get('/api/seller/stats').expect(401);
    await request(app).get('/api/seller/stats').set('Authorization', 'Bearer invalid').expect(401);
    for (const role of ['customer', 'admin'] as const)
      await request(app)
        .get('/api/seller/stats')
        .set('Authorization', 'Bearer ' + createToken(await createUser({ role })))
        .expect(403);
    const banned = await createSellerWithProfile({ user: { isBanned: true } });
    await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + banned.token)
      .expect(403);
    await request(app)
      .get('/api/seller/stats')
      .set('Authorization', 'Bearer ' + createToken(await createUser({ role: 'seller' })))
      .expect(404);
  });
});
