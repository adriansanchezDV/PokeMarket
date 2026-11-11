import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Notification, Order, OrderItem, SellerProfile } from '../../../src/models/indexModel.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createPurchase, payPurchase } from '../../helpers/purchase.js';
import { failTransactionAt } from '../../helpers/transactionFailure.js';

describe('Local payment and stock', () => {
  it('pays pending orders, decrements exact quantities and notifies each seller once', async () => {
    const seller = await createSellerWithProfile();
    const other = await createSellerWithProfile();
    const first = await createProduct({ sellerProfileId: seller.profile.id, stock: 5 });
    const second = await createProduct({ sellerProfileId: seller.profile.id, stock: 5 });
    const third = await createProduct({ sellerProfileId: other.profile.id, stock: 5 });
    const purchase = await createPurchase({
      products: [
        { product: first, quantity: 2 },
        { product: second, quantity: 1 },
        { product: third, quantity: 3 },
      ],
    });
    const response = await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ amount: 0.01, status: 'cancelled' })
      .expect(200);
    expect(response.body).toMatchObject({ id: purchase.order.id, status: 'paid', total: '150.00' });
    expect((await purchase.order.reload()).status).toBe('paid');
    expect((await first.reload()).stock).toBe(3);
    expect((await second.reload()).stock).toBe(4);
    expect((await third.reload()).stock).toBe(2);
    expect(
      await OrderItem.count({ where: { orderId: purchase.order.id, status: 'processing' } }),
    ).toBe(3);
    const sales = await Notification.findAll({ where: { type: 'NEW_SALE' } });
    expect(sales.map((n) => n.userId).sort()).toEqual([seller.user.id, other.user.id].sort());
    expect(await Notification.count({ where: { userId: purchase.user.id } })).toBe(0);
  });

  it('allows spending the last unit without negative stock and keeps checkout prices', async () => {
    const product = await createProduct({ stock: 1 });
    const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
    await product.update({ price: 99 });
    await payPurchase(purchase);
    expect((await product.reload()).stock).toBe(0);
    expect((await purchase.order.reload()).total).toBe('25.00');
    expect((await purchase.orderItems[0].reload()).unitPrice).toBe('25.00');
  });

  it('rejects a sequential duplicate payment without a second stock decrement or notification', async () => {
    const purchase = await payPurchase(await createPurchase());
    const product = purchase.products[0].product;
    const response = await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    expect(response.body).toEqual({ error: 'Order cannot be paid' });
    expect((await product.reload()).stock).toBe(2);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(1);
    expect((await purchase.orderItems[0].reload()).status).toBe('processing');
  });

  it('rejects paying a cancelled pending order without changing stock', async () => {
    const purchase = await createPurchase();
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    expect((await purchase.products[0].product.reload()).stock).toBe(3);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(0);
  });

  it.each([
    'inactive-product',
    'inactive-seller',
    'stock',
    'deleted-product',
    'deleted-seller',
    'changed-seller',
  ] as const)('revalidates %s at payment and leaves the order pending', async (state) => {
    const purchase = await createPurchase();
    const product = purchase.products[0].product;
    if (state === 'inactive-product') await product.update({ isActive: false });
    if (state === 'inactive-seller')
      await SellerProfile.update({ isActive: false }, { where: { id: product.sellerProfileId } });
    if (state === 'stock') await product.update({ stock: 0 });
    if (state === 'deleted-product') await product.destroy();
    if (state === 'deleted-seller')
      await SellerProfile.destroy({ where: { id: product.sellerProfileId } });
    if (state === 'changed-seller')
      await product.update({ sellerProfileId: (await createSellerWithProfile()).profile.id });
    const response = await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(state === 'inactive-seller' ? 403 : state === 'deleted-product' ? 404 : 409);
    const expected =
      state === 'inactive-product'
        ? 'Product is inactive'
        : state === 'inactive-seller'
          ? 'Seller profile is inactive'
          : state === 'stock'
            ? `Insufficient stock for product ${product.id}`
            : state === 'deleted-product'
              ? 'Product not found'
              : 'Order cannot be paid';
    expect(response.body).toEqual({ error: expected });
    expect((await purchase.order.reload()).status).toBe('pending');
    expect((await purchase.orderItems[0].reload()).status).toBe('pending');
    expect(await Notification.count()).toBe(0);
    const history = await request(app)
      .get('/api/orders/' + purchase.order.id)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(history.body.items[0].productName).toBe('Charizard');
  });

  it('rolls back an earlier stock decrement when a later product has insufficient stock', async () => {
    const first = await createProduct();
    const last = await createProduct();
    const purchase = await createPurchase({
      products: [
        { product: first, quantity: 2 },
        { product: last, quantity: 2 },
      ],
    });
    await last.update({ stock: 1 });
    const response = await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    expect(response.body).toEqual({ error: `Insufficient stock for product ${last.id}` });
    expect((await first.reload()).stock).toBe(3);
    expect((await last.reload()).stock).toBe(1);
    expect((await purchase.order.reload()).status).toBe('pending');
    expect(
      await OrderItem.count({ where: { orderId: purchase.order.id, status: 'pending' } }),
    ).toBe(2);
    expect(await Notification.count()).toBe(0);
  });

  it('rolls back stock, statuses and previously inserted notifications on a later real SQL error', async () => {
    const first = await createProduct();
    const last = await createProduct();
    const purchase = await createPurchase({
      products: [
        { product: first, quantity: 1 },
        { product: last, quantity: 1 },
      ],
    });
    const failure = failTransactionAt('notification', 2);
    try {
      const response = await request(app)
        .post(`/api/orders/${purchase.order.id}/pay`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      expect(failure.state.calls).toBe(2);
      expect(failure.state.notifications).toBe(1);
      expect(failure.state.transactionId).not.toBe('');
    } finally {
      failure.remove();
    }
    expect((await first.reload()).stock).toBe(3);
    expect((await last.reload()).stock).toBe(3);
    expect((await purchase.order.reload()).status).toBe('pending');
    expect(await OrderItem.count({ where: { status: 'pending' } })).toBe(2);
    expect(await Notification.count()).toBe(0);
    await payPurchase(purchase);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(2);
  });

  it('rejects missing or other-account orders, including an administrator acting as a buyer', async () => {
    const purchase = await createPurchase();
    for (const role of ['customer', 'admin'] as const) {
      const token = createToken(await createUser({ role }));
      for (const id of [purchase.order.id, 999999]) {
        const response = await request(app)
          .post(`/api/orders/${id}/pay`)
          .set('Authorization', 'Bearer ' + token)
          .expect(404);
        expect(response.body).toEqual({ error: 'Order not found' });
      }
    }
    expect((await purchase.order.reload()).status).toBe('pending');
    expect((await purchase.products[0].product.reload()).stock).toBe(3);
    expect(await Notification.count()).toBe(0);
  });

  it('requires authentication and validates the order ID', async () => {
    await request(app).post('/api/orders/1/pay').expect(401);
    const user = await createUser();
    const token = createToken(user);
    for (const id of ['abc', '0', '-1', '1.5'])
      await request(app)
        .post(`/api/orders/${id}/pay`)
        .set('Authorization', 'Bearer ' + token)
        .expect(400);
    await user.update({ isBanned: true });
    await request(app)
      .post('/api/orders/1/pay')
      .set('Authorization', 'Bearer ' + token)
      .expect(403);
    expect(await Order.count()).toBe(0);
  });
});
