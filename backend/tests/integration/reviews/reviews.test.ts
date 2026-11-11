import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Review } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createProduct } from '../../factories/productFactory.js';
import { createReview } from '../../factories/reviewFactory.js';
import { createReviewPurchase } from '../../helpers/reviewPurchase.js';

describe('Product reviews', () => {
  it('creates a trimmed review only for the authenticated completed buyer', async () => {
    const purchase = await createReviewPurchase();
    const response = await request(app)
      .post(`/api/products/${purchase.product.id}/reviews`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({
        rating: 5,
        comment: '  Great card  ',
        userId: purchase.seller.user.id,
        productId: 999999,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      userId: purchase.user.id,
      productId: purchase.product.id,
      rating: 5,
      comment: 'Great card',
    });
    expect((await Review.findByPk(response.body.id))?.toJSON()).toMatchObject({
      userId: purchase.user.id,
      productId: purchase.product.id,
      rating: 5,
      comment: 'Great card',
    });
    expect(await Review.count()).toBe(1);
  });

  it('accepts a boundary rating and an omitted comment without exposing private buyer data', async () => {
    const purchase = await createReviewPurchase();
    const response = await request(app)
      .post(`/api/products/${purchase.product.id}/reviews`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ rating: 1 })
      .expect(201);
    expect(response.body.comment).toBeNull();
    const list = await request(app).get(`/api/products/${purchase.product.id}/reviews`).expect(200);
    expect(list.body.reviews[0].user).toEqual({
      id: purchase.user.id,
      fullName: purchase.user.fullName,
    });
  });

  it.each(['pending', 'paid', 'cancelled'] as const)(
    'rejects reviews of %s purchases without writes',
    async (state) => {
      const purchase = await createReviewPurchase(state);
      const response = await request(app)
        .post(`/api/products/${purchase.product.id}/reviews`)
        .set('Authorization', 'Bearer ' + purchase.token)
        .send({ rating: 5 })
        .expect(403);
      expect(response.body).toEqual({ error: 'You can only review products you have purchased' });
      expect(await Review.count()).toBe(0);
    },
  );

  it('rejects someone else completed purchase and users with no purchase', async () => {
    const purchase = await createReviewPurchase();
    const otherToken = createToken(await createUser());
    await request(app)
      .post(`/api/products/${purchase.product.id}/reviews`)
      .set('Authorization', 'Bearer ' + otherToken)
      .send({ rating: 5 })
      .expect(403);
    const product = await createProduct();
    await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ rating: 5 })
      .expect(403);
    expect(await Review.count()).toBe(0);
  });

  it('rejects a duplicate from the same buyer with 409 and preserves the first review', async () => {
    const purchase = await createReviewPurchase();
    const path = `/api/products/${purchase.product.id}/reviews`;
    const first = await request(app)
      .post(path)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ rating: 5, comment: 'Original' })
      .expect(201);
    const duplicate = await request(app)
      .post(path)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ rating: 1, comment: 'Replacement' })
      .expect(409);
    expect(duplicate.body).toEqual({ error: 'You have already reviewed this product' });
    expect(await Review.count()).toBe(1);
    expect((await Review.findByPk(first.body.id))?.comment).toBe('Original');
  });

  it('allows an eligible buyer to review an inactive product or inactive seller', async () => {
    const purchase = await createReviewPurchase();
    await purchase.product.update({ isActive: false });
    await purchase.seller.profile.update({ isActive: false });
    await request(app)
      .post(`/api/products/${purchase.product.id}/reviews`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .send({ rating: 5 })
      .expect(201);
    const list = await request(app).get(`/api/products/${purchase.product.id}/reviews`).expect(200);
    expect(list.body.reviewCount).toBe(1);
  });

  it('edits only allowed own fields and deletes the persisted review', async () => {
    const user = await createUser();
    const product = await createProduct();
    const review = await createReview(user.id, product.id, { comment: 'Original' });
    const path = `/api/products/${product.id}/reviews/${review.id}`;
    const token = createToken(user);
    const response = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ rating: 4, comment: '  Updated  ', userId: 999999, productId: 999999 })
      .expect(200);
    expect(response.body).toMatchObject({
      userId: user.id,
      productId: product.id,
      rating: 4,
      comment: 'Updated',
    });
    expect((await review.reload()).rating).toBe(4);
    await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ comment: null })
      .expect(200);
    expect((await review.reload()).comment).toBeNull();
    await request(app)
      .delete(path)
      .set('Authorization', 'Bearer ' + token)
      .expect(204);
    expect(await Review.findByPk(review.id)).toBeNull();
  });

  it.each(['patch', 'delete'] as const)(
    'protects ownership and the product/review pair for %s',
    async (method) => {
      const owner = await createUser();
      const product = await createProduct();
      const review = await createReview(owner.id, product.id);
      const otherProduct = await createProduct();
      const otherToken = createToken(await createUser());
      await request(app)
        [method](`/api/products/${product.id}/reviews/${review.id}`)
        .set('Authorization', 'Bearer ' + otherToken)
        .send({ rating: 1 })
        .expect(404);
      for (const [productId, reviewId] of [
        [otherProduct.id, review.id],
        [product.id, 999999],
      ]) {
        const response = await request(app)
          [method](`/api/products/${productId}/reviews/${reviewId}`)
          .set('Authorization', 'Bearer ' + createToken(owner))
          .send({ rating: 1 })
          .expect(404);
        expect(response.body).toEqual({ error: 'Review not found' });
      }
      expect((await review.reload()).toJSON()).toMatchObject({
        userId: owner.id,
        productId: product.id,
        rating: 5,
      });
    },
  );

  it('paginates reviews while computing aggregates over the entire product', async () => {
    const product = await createProduct();
    const first = await createReview((await createUser()).id, product.id, {
      rating: 5,
      createdAt: new Date('2020-01-01'),
    });
    const second = await createReview((await createUser()).id, product.id, {
      rating: 4,
      createdAt: new Date('2021-01-01'),
    });
    const third = await createReview((await createUser()).id, product.id, {
      rating: 1,
      createdAt: new Date('2022-01-01'),
    });
    const response = await request(app)
      .get(`/api/products/${product.id}/reviews?page=2&limit=1`)
      .expect(200);
    expect(response.body).toMatchObject({
      productId: product.id,
      reviewCount: 3,
      averageRating: 3.33,
      ratingDistribution: { 1: 1, 2: 0, 3: 0, 4: 1, 5: 1 },
      page: 2,
      limit: 1,
      totalPages: 3,
    });
    expect(response.body.reviews.map((r: { id: number }) => r.id)).toEqual([second.id]);
    const firstPage = await request(app)
      .get(`/api/products/${product.id}/reviews?limit=1`)
      .expect(200);
    expect(firstPage.body.reviews[0].id).toBe(third.id);
    const beyond = await request(app)
      .get(`/api/products/${product.id}/reviews?page=4&limit=1`)
      .expect(200);
    expect(beyond.body.reviews).toEqual([]);
    expect(beyond.body.reviewCount).toBe(3);
    expect(first.id).not.toBe(third.id);
  });

  it('reproduces the unpersonalized userReview of the public route even with a valid JWT', async () => {
    const user = await createUser();
    const product = await createProduct();
    const review = await createReview(user.id, product.id);
    const response = await request(app)
      .get(`/api/products/${product.id}/reviews`)
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(response.body.reviews[0].id).toBe(review.id);
    expect(response.body.userReview).toBeNull();
    // Public route behavior is documented; adding optional authentication needs a separate decision.
  });

  it('returns empty aggregates and does not retain reviews of a deleted product', async () => {
    const product = await createProduct();
    const empty = await request(app).get(`/api/products/${product.id}/reviews`).expect(200);
    expect(empty.body).toMatchObject({
      averageRating: 0,
      reviewCount: 0,
      totalPages: 0,
      reviews: [],
      userReview: null,
    });
    await createReview((await createUser()).id, product.id);
    await product.destroy();
    expect(await Review.count()).toBe(0);
    await request(app).get(`/api/products/${product.id}/reviews`).expect(404);
    await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', 'Bearer ' + createToken(await createUser()))
      .send({ rating: 5 })
      .expect(404);
  });

  it.each([
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { rating: '5' },
    { rating: null },
    { rating: 5, comment: 'A'.repeat(1001) },
    { rating: 5, comment: null },
  ])('rejects invalid create payload %j without writing', async (body) => {
    const token = createToken(await createUser());
    const response = await request(app)
      .post('/api/products/1/reviews')
      .set('Authorization', 'Bearer ' + token)
      .send(body)
      .expect(400);
    expect(response.body.error).toBe('Validation failed');
    expect(await Review.count()).toBe(0);
  });

  it.each([{}, { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { comment: 'A'.repeat(1001) }])(
    'rejects invalid edits %j without changing a review',
    async (body) => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview(user.id, product.id);
      await request(app)
        .patch(`/api/products/${product.id}/reviews/${review.id}`)
        .set('Authorization', 'Bearer ' + createToken(user))
        .send(body)
        .expect(400);
      expect((await review.reload()).rating).toBe(5);
    },
  );

  it.each(['page=0', 'page=1.5', 'page=abc', 'limit=0', 'limit=51', 'limit=abc'])(
    'rejects invalid review pagination with 400: %s',
    async (query) => {
      const product = await createProduct();
      const response = await request(app)
        .get(`/api/products/${product.id}/reviews?${query}`)
        .expect(400);
      expect(response.body.error).toBe('Validation failed');
      expect(await Review.count()).toBe(0);
    },
  );

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'validates route IDs for %s',
    async (method) => {
      const token = createToken(await createUser());
      for (const id of ['abc', '0', '-1', '1.5']) {
        await request(app)
          [method](
            `/api/products/${id}/reviews` + (method === 'patch' || method === 'delete' ? '/1' : ''),
          )
          .set('Authorization', 'Bearer ' + token)
          .send({ rating: 5 })
          .expect(400);
        if (method === 'patch' || method === 'delete')
          await request(app)
            [method](`/api/products/1/reviews/${id}`)
            .set('Authorization', 'Bearer ' + token)
            .send({ rating: 5 })
            .expect(400);
      }
    },
  );
});
