import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Notification } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createNotification } from '../../factories/notificationFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createReviewPurchase } from '../../helpers/reviewPurchase.js';
import { createPurchase } from '../../helpers/purchase.js';

describe('Own notifications', () => {
  it('returns an empty list, zero unread and zero bulk updates without creating rows', async () => {
    const token = createToken(await createUser());
    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(list.body).toEqual([]);
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(count.body).toEqual({ count: 0 });
    const all = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(all.body).toEqual({ message: 'Notifications marked as read', updatedCount: 0 });
    expect(await Notification.count()).toBe(0);
  });

  it('lists only own notifications in date order with a safe sender projection', async () => {
    const user = await createUser();
    const sender = await createUser({ fullName: 'Sender Example' });
    const old = await createNotification(user.id, {
      senderId: sender.id,
      createdAt: new Date('2020-01-01'),
      message: 'Old message',
    });
    const recent = await createNotification(user.id, {
      createdAt: new Date('2021-01-01'),
      isRead: true,
    });
    await createNotification(sender.id);
    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(response.body.map((n: { id: number }) => n.id)).toEqual([recent.id, old.id]);
    expect(response.body[1]).toMatchObject({
      userId: user.id,
      title: 'Testing notification',
      message: 'Old message',
      isRead: false,
      sender: { id: sender.id, fullName: sender.fullName },
    });
    expect(response.body[1].sender).not.toHaveProperty('password');
    expect(response.body[1].sender).not.toHaveProperty('email');
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(count.body.count).toBe(1);
  });

  it('marks an own notification read idempotently and preserves its original content', async () => {
    const user = await createUser();
    const notification = await createNotification(user.id);
    const token = createToken(user);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set('Authorization', 'Bearer ' + token)
        .send({ userId: 999999, title: 'Replaced' })
        .expect(200);
      expect(response.body).toMatchObject({
        id: notification.id,
        isRead: true,
        title: 'Testing notification',
      });
    }
    expect((await notification.reload()).toJSON()).toMatchObject({
      userId: user.id,
      isRead: true,
      message: 'Testing message',
    });
    expect(await Notification.count()).toBe(1);
  });

  it('marks only own unread rows and reports the actual updated count', async () => {
    const user = await createUser();
    const first = await createNotification(user.id);
    const second = await createNotification(user.id);
    await createNotification(user.id, { isRead: true });
    const foreign = await createNotification((await createUser()).id);
    const token = createToken(user);
    const response = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', 'Bearer ' + token)
      .send({ userId: foreign.userId })
      .expect(200);
    expect(response.body.updatedCount).toBe(2);
    expect((await first.reload()).isRead).toBe(true);
    expect((await second.reload()).isRead).toBe(true);
    expect((await foreign.reload()).isRead).toBe(false);
    const again = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(again.body.updatedCount).toBe(0);
    const unread = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(unread.body.count).toBe(0);
  });

  it('rejects missing or foreign notification IDs without changing their state', async () => {
    const foreign = await createNotification((await createUser()).id);
    const token = createToken(await createUser());
    for (const id of [foreign.id, 999999]) {
      const response = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set('Authorization', 'Bearer ' + token)
        .expect(404);
      expect(response.body).toEqual({ message: 'Notification not found' });
    }
    expect((await foreign.reload()).isRead).toBe(false);
  });

  it('retains notifications if the sender or product is deleted', async () => {
    const user = await createUser();
    const sender = await createUser();
    const product = await createProduct();
    const notification = await createNotification(user.id, {
      senderId: sender.id,
      productId: product.id,
    });
    await sender.destroy();
    await product.destroy();
    expect((await notification.reload()).toJSON()).toMatchObject({
      senderId: null,
      productId: null,
      message: 'Testing message',
    });
    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(response.body[0]).toMatchObject({ id: notification.id, sender: null });
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'rejects invalid notification ID %s with 400 before SQL',
    async (id) => {
      const user = await createUser();
      const notification = await createNotification(user.id);
      const response = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(400);
      expect(response.body).toEqual({ message: 'Invalid notification ID' });
      expect((await notification.reload()).isRead).toBe(false);
    },
  );

  it('exposes payment, shipping, delivery and cancellation events through the HTTP inbox', async () => {
    const purchase = await createReviewPurchase();
    const sale = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + purchase.seller.token)
      .expect(200);
    expect(sale.body.map((n: { type: string }) => n.type)).toEqual(['NEW_SALE']);
    expect(sale.body[0]).toMatchObject({
      userId: purchase.seller.user.id,
      title: 'Nueva venta',
      isRead: false,
    });
    const buyer = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(buyer.body.map((n: { type: string }) => n.type).sort()).toEqual([
      'ORDER_DELIVERED',
      'ORDER_SHIPPED',
    ]);
    const cancelled = await createPurchase();
    await request(app)
      .post(`/api/orders/${cancelled.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + cancelled.token)
      .expect(200);
    const cancellation = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + cancelled.token)
      .expect(200);
    expect(cancellation.body).toHaveLength(1);
    expect(cancellation.body[0]).toMatchObject({
      type: 'ORDER_CANCELLED',
      userId: cancelled.user.id,
      isRead: false,
    });
  });

  it('exposes favorite restock and price-drop messages for the actual follower', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id, stock: 0 });
    const follower = await createUser();
    const token = createToken(follower);
    await request(app)
      .post('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    await request(app)
      .patch('/api/products/' + product.id)
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ stock: 2, price: 20 })
      .expect(200);
    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body.map((n: { type: string }) => n.type).sort()).toEqual([
      'favorite_price_drop',
      'favorite_restock',
    ]);
    expect(
      response.body.every(
        (n: { productId: number; message: string }) =>
          n.productId === product.id && n.message.includes('Charizard'),
      ),
    ).toBe(true);
    const price = response.body.find((n: { type: string }) => n.type === 'favorite_price_drop');
    expect(price.message).toContain('25.00');
    expect(price.message).toContain('20.00');
  });

  it('does not provide an HTTP route to create arbitrary notifications', async () => {
    const token = createToken(await createUser());
    await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer ' + token)
      .send({ userId: 999999, type: 'Forged', title: 'Fake', message: 'Fake' })
      .expect(404);
    expect(await Notification.count()).toBe(0);
  });
});
