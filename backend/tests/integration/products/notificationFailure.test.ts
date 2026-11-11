import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Favorite, Notification } from '../../../src/models/indexModel.js';
import sequelize from '../../helpers/testDatabase.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createUser } from '../../helpers/userTestHelpers.js';

describe('Favorite notification failures after a committed product edit', () => {
  it.each(['favorite_restock', 'favorite_price_drop'] as const)(
    'keeps the confirmed HTTP result and other event when %s fails in PostgreSQL',
    async (type) => {
      const seller = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: seller.profile.id, stock: 0 });
      const follower = await createUser();
      await Favorite.create({ userId: follower.id, productId: product.id });
      let attempted = 0;
      let committedBeforeFailure = false;
      const log = vi.spyOn(console, 'error');
      const name = 'test-favorite-post-commit-sql-failure';
      Notification.addHook('beforeCreate', name, async (notification, options) => {
        if (notification.get('type') !== type) return;
        attempted++;
        expect(options.transaction).toBeUndefined();
        const persisted = await product.reload();
        committedBeforeFailure = persisted.stock === 5 && persisted.price === '20.00';
        await sequelize.query('SELECT 1 / 0');
      });
      let response: request.Response;
      try {
        response = await request(app)
          .patch('/api/products/' + product.id)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ stock: 5, price: 20 })
          .timeout({ response: 8_000, deadline: 9_000 });
      } finally {
        Notification.removeHook('beforeCreate', name);
      }
      expect(attempted).toBe(1);
      expect(committedBeforeFailure).toBe(true);
      expect((await product.reload()).toJSON()).toMatchObject({
        stock: 5,
        price: '20.00',
        isActive: true,
      });
      expect(log).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: product.id, stock: 5, price: '20.00' });
      expect(await Notification.count({ where: { userId: follower.id, type } })).toBe(0);
      const other = type === 'favorite_restock' ? 'favorite_price_drop' : 'favorite_restock';
      expect(await Notification.count({ where: { userId: follower.id, type: other } })).toBe(1);
    },
  );
});
