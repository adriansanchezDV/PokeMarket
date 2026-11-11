import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Favorite } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createReview } from '../../factories/reviewFactory.js';
import { createNotification } from '../../factories/notificationFactory.js';

const routes = [
  ['get', 'favorites'],
  ['post', 'favorite'],
  ['delete', 'favorite'],
  ['post', 'reviews'],
  ['patch', 'review'],
  ['delete', 'review'],
  ['get', 'notifications'],
  ['get', 'unread'],
  ['patch', 'read'],
  ['patch', 'read-all'],
  ['get', 'admin-access'],
  ['get', 'dashboard'],
  ['get', 'users'],
  ['get', 'user'],
  ['patch', 'ban'],
  ['patch', 'seller-status'],
] as const;

describe('Security across engagement and administration', () => {
  it.each(routes)(
    'rejects invalid and banned credentials for %s %s without side effects',
    async (method, operation) => {
      const administrative = [
        'admin-access',
        'dashboard',
        'users',
        'user',
        'ban',
        'seller-status',
      ].includes(operation);
      const actor = await createUser({ role: administrative ? 'admin' : 'customer' });
      const target = await createUser();
      const seller = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: seller.profile.id });
      const review = await createReview(actor.id, product.id);
      const notification = await createNotification(actor.id);
      const favorite = await Favorite.create({ userId: actor.id, productId: product.id });
      const paths: Record<string, string> = {
        favorites: '/api/favorites',
        favorite: '/api/favorites/' + product.id,
        reviews: `/api/products/${product.id}/reviews`,
        review: `/api/products/${product.id}/reviews/${review.id}`,
        notifications: '/api/notifications',
        unread: '/api/notifications/unread-count',
        read: `/api/notifications/${notification.id}/read`,
        'read-all': '/api/notifications/read-all',
        'admin-access': '/api/admin/access',
        dashboard: '/api/admin/dashboard',
        users: '/api/admin/users',
        user: '/api/admin/users/' + target.id,
        ban: `/api/admin/users/${target.id}/ban`,
        'seller-status': `/api/admin/sellers/${seller.profile.id}/status`,
      };
      const body = {
        rating: 1,
        comment: 'Forged',
        isActive: false,
        isBanned: true,
        userId: target.id,
      };
      // Favorites already test missing authentication in E1; exercise it here for the other modules.
      if (operation !== 'favorites' && operation !== 'favorite')
        await request(app)[method](paths[operation]).send(body).expect(401);
      await request(app)
        [method](paths[operation])
        .set('Authorization', 'Bearer invalid-token')
        .send(body)
        .expect(401);
      const previousToken = createToken(actor);
      await actor.update({ isBanned: true });
      const denied = await request(app)
        [method](paths[operation])
        .set('Authorization', 'Bearer ' + previousToken)
        .send(body)
        .expect(403);
      expect(denied.body).toEqual({ error: 'User account is banned' });
      expect((await notification.reload()).isRead).toBe(false);
      expect((await review.reload()).rating).toBe(5);
      expect(await Favorite.findByPk(favorite.id)).not.toBeNull();
      expect((await target.reload()).isBanned).toBe(false);
      expect((await seller.profile.reload()).isActive).toBe(true);
      expect((await product.reload()).stock).toBe(3);
    },
  );

  it.each(['access', 'dashboard', 'users', 'user', 'ban', 'seller-status'] as const)(
    'restricts admin %s to the current PostgreSQL role',
    async (operation) => {
      const target = await createUser();
      const seller = await createSellerWithProfile();
      const path =
        operation === 'user'
          ? '/api/admin/users/' + target.id
          : operation === 'ban'
            ? `/api/admin/users/${target.id}/ban`
            : operation === 'seller-status'
              ? `/api/admin/sellers/${seller.profile.id}/status`
              : '/api/admin/' + operation;
      const method = operation === 'ban' || operation === 'seller-status' ? 'patch' : 'get';
      for (const role of ['customer', 'seller'] as const) {
        const actor = await createUser({ role: 'admin' });
        const token = createToken(actor);
        await actor.update({ role });
        const response = await request(app)
          [method](path)
          .set('Authorization', 'Bearer ' + token)
          .send({ isActive: false, isBanned: true })
          .expect(403);
        expect(response.body).toEqual({ error: 'Insufficient permissions' });
      }
      expect((await target.reload()).isBanned).toBe(false);
      expect((await seller.profile.reload()).isActive).toBe(true);
    },
  );
});
