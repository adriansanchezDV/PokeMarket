import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Favorite } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createProduct } from '../../factories/productFactory.js';
import { concurrentCreates } from '../../helpers/concurrentCreates.js';

describe('Concurrent favorites', () => {
  it('uses the PostgreSQL unique constraint to keep one favorite and return a controlled conflict', async () => {
    const user = await createUser();
    const product = await createProduct();
    const token = createToken(user);
    const responses = await concurrentCreates(Favorite, [
      request(app)
        .post('/api/favorites/' + product.id)
        .set('Authorization', 'Bearer ' + token),
      request(app)
        .post('/api/favorites/' + product.id)
        .set('Authorization', 'Bearer ' + token),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body).toEqual({
      error: 'Resource already exists',
    });
    expect(await Favorite.count({ where: { userId: user.id, productId: product.id } })).toBe(1);
  }, 15_000);
});
