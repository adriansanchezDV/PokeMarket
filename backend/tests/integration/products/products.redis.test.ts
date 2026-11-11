import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import redis from '../../../src/config/redis.js';
import { createCard } from '../../factories/cardFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

describe('Product writes invalidate cached card offers', () => {
  it('invalidates affected offers after creation, edits and status changes while preserving unrelated details', async () => {
    const { profile, token } = await createSellerWithProfile();
    const card = await createCard();
    const other = await createCard();
    await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    await request(app)
      .get('/api/cards/' + other.id)
      .expect(200);
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + token)
      .send({ cardId: card.id, condition: 'Near Mint', language: 'English', price: 25, stock: 3 })
      .expect(201);
    const id = created.body.id;
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    const detail = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(detail.body.products[0]).toMatchObject({ id, stock: 3, price: '25.00' });
    await request(app)
      .patch('/api/products/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send({ price: 20, stock: 5 })
      .expect(200);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    const edited = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(edited.body.products[0]).toMatchObject({ id, stock: 5, price: '20.00' });
    for (const isActive of [false, true]) {
      await request(app)
        .patch(`/api/products/${id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive })
        .expect(200);
      expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
      const response = await request(app)
        .get('/api/cards/' + card.id)
        .expect(200);
      expect(response.body.products.map((p: { id: number }) => p.id)).toEqual(isActive ? [id] : []);
    }
    expect(created.body.sellerProfileId).toBe(profile.id);
    expect(await redis.exists('cards:detail:' + other.id)).toBe(1);
  });

  it('invalidates offers when their stock reaches zero', async () => {
    const { profile, token } = await createSellerWithProfile();
    const card = await createCard();
    const product = await createProduct({ sellerProfileId: profile.id, cardId: card.id });
    await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    await request(app)
      .patch('/api/products/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ stock: 0 })
      .expect(200);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    const response = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(response.body.products).toEqual([]);
  });

  it('invalidates seller offers after a commercial profile edit without removing unrelated details', async () => {
    const { profile, token } = await createSellerWithProfile();
    const card = await createCard();
    await createProduct({ sellerProfileId: profile.id, cardId: card.id });
    const unrelated = await createCard();
    await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    await request(app)
      .get('/api/cards/' + unrelated.id)
      .expect(200);
    await request(app)
      .patch('/api/sellers/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({ storeName: 'Updated Store' })
      .expect(200);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    expect(await redis.exists('cards:detail:' + unrelated.id)).toBe(1);
    const fresh = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(fresh.body.products[0].seller.storeName).toBe('Updated Store');
  });
});
