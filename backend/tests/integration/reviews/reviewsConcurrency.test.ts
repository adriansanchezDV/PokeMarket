import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Review } from '../../../src/models/indexModel.js';
import { createReviewPurchase } from '../../helpers/reviewPurchase.js';
import { concurrentCreates } from '../../helpers/concurrentCreates.js';

describe('Concurrent reviews', () => {
  it('keeps one eligible review when both preflight duplicate checks passed', async () => {
    const purchase = await createReviewPurchase();
    const path = `/api/products/${purchase.product.id}/reviews`;
    const responses = await concurrentCreates(Review, [
      request(app)
        .post(path)
        .set('Authorization', 'Bearer ' + purchase.token)
        .send({ rating: 5, comment: 'First submission' }),
      request(app)
        .post(path)
        .set('Authorization', 'Bearer ' + purchase.token)
        .send({ rating: 4, comment: 'Other submission' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body).toEqual({
      error: 'Resource already exists',
    });
    const review = await Review.findOne({
      where: { userId: purchase.user.id, productId: purchase.product.id },
    });
    expect(await Review.count()).toBe(1);
    expect(review!.id).toBe(responses.find((r) => r.status === 201)!.body.id);
    expect(review!.rating).toBe(responses.find((r) => r.status === 201)!.body.rating);
  }, 15_000);
});
