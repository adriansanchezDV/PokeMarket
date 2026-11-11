import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Favorite } from '../../../src/models/indexModel.js';
import sequelize from '../../helpers/testDatabase.js';
import { createToken, createUser } from '../../helpers/userTestHelpers.js';
import { createSet } from '../../factories/setFactory.js';
import { createCard } from '../../factories/cardFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

const catalog = async () => {
  const seller = await createSellerWithProfile();
  const other = await createSellerWithProfile();
  const set = await createSet();
  const card = await createCard({ setId: set.id });
  const otherCard = await createCard({
    name: 'Squirtle',
    number: '99',
    rarity: 'Common',
    category: 'Trainer',
    artist: 'Other Artist',
    description: 'A small turtle.',
    types: ['Water'],
    hp: 60,
  });
  const target = await createProduct({ cardId: card.id, sellerProfileId: seller.profile.id });
  const high = await createProduct({
    cardId: otherCard.id,
    sellerProfileId: other.profile.id,
    price: 100,
    stock: 8,
    condition: 'Played',
    language: 'French',
  });
  const low = await createProduct({
    cardId: otherCard.id,
    sellerProfileId: other.profile.id,
    price: 5,
    stock: 1,
    condition: 'Played',
    language: 'French',
  });
  return { seller, set, card, target, high, low };
};

describe('Products API', () => {
  describe('GET /api/products', () => {
    it('returns products and pagination information', async () => {
      const product = await createProduct();
      const response = await request(app).get('/api/products').expect(200);
      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: product.id,
        price: '25.00',
        stock: 3,
        isFavorite: false,
      });
    });

    it('paginates persisted products and sorts prices in both directions', async () => {
      const { target, high, low } = await catalog();
      const response = await request(app)
        .get('/api/products')
        .query({ page: 2, limit: 1, sort: 'price', order: 'ASC' })
        .expect(200);
      expect(response.body.data.map((p: { id: number }) => p.id)).toEqual([target.id]);
      expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
      const descending = await request(app)
        .get('/api/products')
        .query({ sort: 'price', order: 'DESC' })
        .expect(200);
      expect(descending.body.data.map((p: { id: number }) => p.id)).toEqual([
        high.id,
        target.id,
        low.id,
      ]);
    });

    it('filters persisted products by combined offer attributes', async () => {
      const { target, card, seller } = await catalog();
      const response = await request(app)
        .get('/api/products')
        .query({
          cardId: card.id,
          sellerProfileId: seller.profile.id,
          condition: 'Near Mint',
          language: 'English',
          minPrice: 10,
          maxPrice: 50,
        })
        .expect(200);
      expect(response.body.data.map((p: { id: number }) => p.id)).toEqual([target.id]);
      expect(response.body.pagination.total).toBe(1);
    });

    it('combines card search with offer filters on persisted products', async () => {
      const { target, set, seller } = await catalog();
      const response = await request(app)
        .get('/api/products')
        .query({
          search: 'charIZard',
          setId: set.id,
          rarity: 'Rare Holo',
          category: 'Pokemon',
          number: '4',
          artist: 'Arita',
          type: 'Fire',
          minHp: 100,
          maxHp: 200,
          minPrice: 20,
          maxPrice: 30,
          sellerProfileId: seller.profile.id,
          language: 'English',
          condition: 'Near Mint',
        })
        .expect(200);
      expect(response.body.data.map((p: { id: number }) => p.id)).toEqual([target.id]);
    });

    it.each([
      ['page=0', 'Page must be a positive integer'],
      ['page=-1', 'Page must be a positive integer'],
      ['page=1.5', 'Page must be a positive integer'],
      ['limit=0', 'Limit must be between 1 and 100'],
      ['limit=101', 'Limit must be between 1 and 100'],
      ['cardId=abc', 'cardId must be a positive integer'],
      ['cardId=0', 'cardId must be a positive integer'],
      ['sellerProfileId=abc', 'sellerProfileId must be a positive integer'],
      ['sellerProfileId=0', 'sellerProfileId must be a positive integer'],
      ['setId=abc', 'setId must be a positive integer'],
      ['setId=0', 'setId must be a positive integer'],
      ['minHp=-1', 'minHp must be a non-negative integer'],
      ['minHp=10.5', 'minHp must be a non-negative integer'],
      ['maxHp=-1', 'maxHp must be a non-negative integer'],
      ['maxHp=10.5', 'maxHp must be a non-negative integer'],
      ['minHp=150&maxHp=100', 'minHp cannot be greater than maxHp'],
      ['minPrice=-1', 'minPrice must be a valid non-negative number'],
      ['minPrice=abc', 'minPrice must be a valid non-negative number'],
      ['maxPrice=-1', 'maxPrice must be a valid non-negative number'],
      ['maxPrice=abc', 'maxPrice must be a valid non-negative number'],
      ['minPrice=50&maxPrice=10', 'minPrice cannot be greater than maxPrice'],
      ['sort=name', 'Invalid sort field'],
      ['order=RANDOM', 'Order must be ASC or DESC'],
    ])('returns 400 for invalid query %s', async (query, error) => {
      const response = await request(app).get(`/api/products?${query}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error });
    });

    it('accepts the maximum limit of 100', async () => {
      await createProduct();
      const response = await request(app).get('/api/products?limit=100').expect(200);
      expect(response.body.pagination.limit).toBe(100);
      expect(response.body.data).toHaveLength(1);
    });

    it.each([
      'search',
      'cardId',
      'sellerProfileId',
      'condition',
      'language',
      'setId',
      'rarity',
      'category',
      'number',
      'artist',
      'type',
      'minHp',
      'maxHp',
    ])('filters persisted products by %s independently', async (filter) => {
      const { target, high, low, card, set, seller } = await catalog();
      const values: Record<string, string | number> = {
        search: 'charIZard',
        cardId: card.id,
        sellerProfileId: seller.profile.id,
        condition: 'Near Mint',
        language: 'English',
        setId: set.id,
        rarity: 'Rare Holo',
        category: 'Pokemon',
        number: '4',
        artist: 'arita',
        type: 'Fire',
        minHp: 100,
        maxHp: 60,
      };
      const response = await request(app)
        .get('/api/products')
        .query({ [filter]: values[filter], sort: 'id', order: 'ASC' })
        .expect(200);
      expect(response.body.data.map((p: { id: number }) => p.id)).toEqual(
        filter === 'maxHp' ? [high.id, low.id] : [target.id],
      );
    });

    it.each(['minPrice', 'maxPrice', 'between'] as const)(
      'applies the %s price boundary',
      async (filter) => {
        const { target, high, low } = await catalog();
        const query =
          filter === 'minPrice'
            ? { minPrice: 25 }
            : filter === 'maxPrice'
              ? { maxPrice: 25 }
              : { minPrice: 25, maxPrice: 25 };
        const response = await request(app)
          .get('/api/products')
          .query({ ...query, sort: 'price', order: 'ASC' })
          .expect(200);
        const expected =
          filter === 'minPrice'
            ? [target.id, high.id]
            : filter === 'maxPrice'
              ? [low.id, target.id]
              : [target.id];
        expect(response.body.data.map((p: { id: number }) => p.id)).toEqual(expected);
      },
    );

    it.each(['4', 'arita', 'powerful'])(
      'searches number, artist and description using Op.or: %s',
      async (search) => {
        const { target } = await catalog();
        const response = await request(app).get('/api/products').query({ search }).expect(200);
        expect(response.body.data.map((p: { id: number }) => p.id)).toEqual([target.id]);
      },
    );

    it.each(['id', 'stock', 'createdAt'] as const)(
      'orders by %s in both directions',
      async (sort) => {
        const { target, high, low } = await catalog();
        await target.update({ created_at: new Date('2020-01-01') });
        await high.update({ created_at: new Date('2021-01-01') });
        await low.update({ created_at: new Date('2022-01-01') });
        const expected =
          sort === 'stock' ? [low.id, target.id, high.id] : [target.id, high.id, low.id];
        for (const order of ['ASC', 'DESC']) {
          const response = await request(app)
            .get('/api/products')
            .query({ sort, order })
            .expect(200);
          expect(response.body.data.map((p: { id: number }) => p.id)).toEqual(
            order === 'ASC' ? expected : [...expected].reverse(),
          );
        }
      },
    );

    it('excludes inactive products and sellers but keeps active zero-stock offers visible', async () => {
      const { target, high, low, seller } = await catalog();
      await target.update({ stock: 0 });
      await high.update({ isActive: false });
      const other = await createSellerWithProfile({ isActive: false });
      await low.update({ sellerProfileId: other.profile.id });
      const response = await request(app).get('/api/products').expect(200);
      expect(response.body.data.map((p: { id: number }) => p.id)).toEqual([target.id]);
      expect(response.body.data[0].stock).toBe(0);
      await seller.profile.update({ isActive: false });
      const empty = await request(app).get('/api/products').expect(200);
      expect(empty.body.data).toEqual([]);
      expect(empty.body.pagination.total).toBe(0);
    });

    it('returns an empty page beyond the last page without losing the total', async () => {
      await createProduct();
      const response = await request(app).get('/api/products?page=2&limit=1').expect(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 1, totalPages: 1 });
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns a product with its card and seller information', async () => {
      const product = await createProduct();
      const response = await request(app)
        .get('/api/products/' + product.id)
        .expect(200);
      expect(response.body).toMatchObject({
        id: product.id,
        card: { id: product.cardId, name: 'Charizard' },
        sellerProfile: { id: product.sellerProfileId },
        isFavorite: false,
      });
    });

    it('returns 400 when the product ID is not numeric', async () => {
      const response = await request(app).get('/api/products/abc').expect(400);
      expect(response.body).toEqual({ error: 'Invalid product id' });
    });

    it('returns 404 when the product does not exist', async () => {
      const response = await request(app).get('/api/products/999999').expect(404);
      expect(response.body).toEqual({ error: 'Product not found' });
    });

    it('returns 500 when retrieving the product fails', async () => {
      // Failure at the database connection boundary; controllers/services/SQL stay real.
      vi.spyOn(sequelize.connectionManager, 'getConnection').mockRejectedValueOnce(
        new Error('private SQL credentials'),
      );
      const response = await request(app).get('/api/products/1').expect(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('keeps an inactive product detail visible and hides an inactive seller detail', async () => {
      const { profile } = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: profile.id, isActive: false });
      const response = await request(app)
        .get('/api/products/' + product.id)
        .expect(200);
      expect(response.body.isActive).toBe(false);
      await profile.update({ isActive: false });
      await request(app)
        .get('/api/products/' + product.id)
        .expect(404);
    });
  });

  it('personalizes list and detail favorites without leaking between users', async () => {
    const product = await createProduct();
    const user = await createUser();
    const other = await createUser();
    await Favorite.create({ userId: user.id, productId: product.id });
    for (const path of ['/api/products', '/api/products/' + product.id]) {
      for (const [token, favorite] of [
        [createToken(user), true],
        [createToken(other), false],
        [undefined, false],
      ] as const) {
        const req = request(app).get(path);
        if (token) req.set('Authorization', 'Bearer ' + token);
        const response = await req.expect(200);
        expect((response.body.data?.[0] ?? response.body).isFavorite).toBe(favorite);
      }
    }
  });

  it.each(['list', 'detail'])(
    'optionalAuth keeps %s public but rejects invalid and banned credentials',
    async (route) => {
      const product = await createProduct();
      const path = route === 'list' ? '/api/products' : '/api/products/' + product.id;
      await request(app).get(path).expect(200);
      await request(app).get(path).set('Authorization', 'Basic forged').expect(401);
      await request(app).get(path).set('Authorization', 'Bearer invalid').expect(401);
      const user = await createUser({ isBanned: true });
      const response = await request(app)
        .get(path)
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(403);
      expect(response.body).toEqual({ error: 'User account is banned' });
    },
  );
});
