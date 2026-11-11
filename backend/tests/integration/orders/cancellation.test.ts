import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Notification, OrderItem, SellerProfile } from '../../../src/models/indexModel.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createPurchase, payPurchase } from '../../helpers/purchase.js';
import { failTransactionAt } from '../../helpers/transactionFailure.js';

describe('Order cancellation', () => {
  it.each(['pending', 'paid'] as const)(
    'cancels %s once and restores only previously deducted stock',
    async (initial) => {
      const product = await createProduct({ stock: 5 });
      const purchase = await createPurchase({ products: [{ product, quantity: 2 }] });
      if (initial === 'paid') await payPurchase(purchase);
      expect((await product.reload()).stock).toBe(initial === 'paid' ? 3 : 5);
      const response = await request(app)
        .post(`/api/orders/${purchase.order.id}/cancel`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(200);
      expect(response.body.status).toBe('cancelled');
      expect((await product.reload()).stock).toBe(5);
      expect((await purchase.order.reload()).status).toBe('cancelled');
      expect((await purchase.orderItems[0].reload()).toJSON()).toMatchObject({
        status: 'cancelled',
        quantity: 2,
        unitPrice: '25.00',
      });
      await request(app)
        .post(`/api/orders/${purchase.order.id}/cancel`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(409);
      expect((await product.reload()).stock).toBe(5);
      const notifications = await Notification.findAll({ where: { type: 'ORDER_CANCELLED' } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].userId).toBe(purchase.user.id);
    },
  );

  it('restores all products even after product or seller deactivation', async () => {
    const first = await createProduct();
    const second = await createProduct();
    const purchase = await payPurchase(
      await createPurchase({
        products: [
          { product: first, quantity: 1 },
          { product: second, quantity: 2 },
        ],
      }),
    );
    await first.update({ isActive: false });
    await SellerProfile.update({ isActive: false }, { where: { id: second.sellerProfileId } });
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect((await first.reload()).toJSON()).toMatchObject({ stock: 3, isActive: false });
    expect((await second.reload()).stock).toBe(3);
    expect(await OrderItem.count({ where: { status: 'cancelled' } })).toBe(2);
  });

  it('keeps historical lines and cancels paid orders whose product was deleted', async () => {
    const purchase = await payPurchase(await createPurchase());
    await purchase.products[0].product.destroy();
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect((await purchase.orderItems[0].reload()).toJSON()).toMatchObject({
      productId: null,
      productName: 'Charizard',
      status: 'cancelled',
      unitPrice: '25.00',
    });
  });

  it.each(['shipped', 'delivered'] as const)(
    'rejects cancellation when any line is %s, without partially restoring stock',
    async (status) => {
      const seller = await createSellerWithProfile();
      const first = await createProduct({ sellerProfileId: seller.profile.id });
      const second = await createProduct({ sellerProfileId: seller.profile.id });
      const purchase = await payPurchase(
        await createPurchase({
          products: [
            { product: first, quantity: 1 },
            { product: second, quantity: 1 },
          ],
        }),
      );
      const item = purchase.orderItems[1];
      await request(app)
        .patch(`/api/seller/orders/${item.id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status: 'shipped' })
        .expect(200);
      if (status === 'delivered')
        await request(app)
          .patch(`/api/seller/orders/${item.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status: 'delivered' })
          .expect(200);
      const response = await request(app)
        .post(`/api/orders/${purchase.order.id}/cancel`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(409);
      expect(response.body).toEqual({ error: 'Order cannot be cancelled' });
      expect((await first.reload()).stock).toBe(2);
      expect((await second.reload()).stock).toBe(2);
      expect((await purchase.order.reload()).status).toBe('paid');
      expect((await purchase.orderItems[0].reload()).status).toBe('processing');
      expect(await Notification.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(0);
    },
  );

  it('rolls back stock restoration, line statuses and order status if notification insertion fails', async () => {
    const purchase = await payPurchase(await createPurchase());
    const failure = failTransactionAt('notification');
    try {
      const response = await request(app)
        .post(`/api/orders/${purchase.order.id}/cancel`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      expect(failure.state.calls).toBe(1);
      expect(failure.state.transactionId).not.toBe('');
    } finally {
      failure.remove();
    }
    expect((await purchase.products[0].product.reload()).stock).toBe(2);
    expect((await purchase.order.reload()).status).toBe('paid');
    expect((await purchase.orderItems[0].reload()).status).toBe('processing');
    expect(await Notification.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(0);
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect((await purchase.products[0].product.reload()).stock).toBe(3);
  });

  it('rejects missing, foreign, unauthenticated and banned cancellation requests', async () => {
    const purchase = await createPurchase();
    await request(app).post(`/api/orders/${purchase.order.id}/cancel`).expect(401);
    const other = createToken(await createUser());
    for (const id of [purchase.order.id, 999999])
      await request(app)
        .post(`/api/orders/${id}/cancel`)
        .set('Authorization', 'Bearer ' + other)
        .expect(404);
    for (const id of ['abc', '0', '-1', '1.5'])
      await request(app)
        .post(`/api/orders/${id}/cancel`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .expect(400);
    await purchase.user.update({ isBanned: true });
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(403);
    expect((await purchase.order.reload()).status).toBe('pending');
    expect((await purchase.products[0].product.reload()).stock).toBe(3);
    expect(await Notification.count()).toBe(0);
  });
});
