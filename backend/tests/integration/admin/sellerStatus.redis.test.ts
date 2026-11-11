import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import redis from '../../../src/config/redis.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';

describe('Administrative seller status and real Redis', () => {
  it('invalidates only the changed seller offers on deactivation and reactivation', async () => {
    const token = createToken(await createUser({ role: 'admin' }));
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const other = await createProduct();
    for (const isActive of [false, true]) {
      await request(app)
        .get('/api/cards/' + product.cardId)
        .expect(200);
      await request(app)
        .get('/api/cards/' + other.cardId)
        .expect(200);
      await request(app)
        .patch(`/api/admin/sellers/${seller.profile.id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive })
        .expect(200);
      expect((await seller.profile.reload()).isActive).toBe(isActive);
      expect(await redis.exists('cards:detail:' + product.cardId)).toBe(0);
      expect(await redis.exists('cards:detail:' + other.cardId)).toBe(1);
      const detail = await request(app)
        .get('/api/cards/' + product.cardId)
        .expect(200);
      expect(detail.body.products.map((p: { id: number }) => p.id)).toEqual(
        isActive ? [product.id] : [],
      );
    }
  });
});
