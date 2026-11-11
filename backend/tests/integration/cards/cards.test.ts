import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import sequelize from '../../helpers/testDatabase.js';
import { createSet } from '../../factories/setFactory.js';
import { createCard } from '../../factories/cardFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

describe('Cards API', () => {
  describe('GET /api/cards', () => {
    it('returns the cards and pagination information', async () => {
      const set = await createSet();
      const first = await createCard({ setId: set.id });
      const second = await createCard({ setId: set.id, name: 'Blastoise' });
      const response = await request(app).get('/api/cards').expect(200);
      expect(response.body.data.map((c: { id: number }) => c.id)).toEqual([first.id, second.id]);
      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    });

    it('combines search, filters and pagination on persisted cards', async () => {
      const set = await createSet();
      const first = await createCard({ setId: set.id });
      const second = await createCard({ setId: set.id });
      await createCard({
        name: 'Unrelated',
        category: 'Trainer',
        rarity: 'Common',
        hp: 20,
        types: ['Water'],
      });
      const response = await request(app)
        .get('/api/cards')
        .query({
          search: 'Charizard',
          setId: set.id,
          rarity: 'Rare Holo',
          category: 'Pokemon',
          number: '4',
          artist: 'Arita',
          type: 'Fire',
          minHp: 100,
          maxHp: 150,
          page: 2,
          limit: 1,
        })
        .expect(200);
      expect(response.body.data.map((c: { id: number }) => c.id)).toEqual([second.id]);
      expect(response.body.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      expect(first.id).not.toBe(second.id);
    });

    it('returns 400 when minHp is negative', async () => {
      const response = await request(app).get('/api/cards?minHp=-1');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid minHp' });
    });

    it('returns 400 when minHp is not an integer', async () => {
      const response = await request(app).get('/api/cards?minHp=10.5');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid minHp' });
    });

    it('returns 400 when maxHp is negative', async () => {
      const response = await request(app).get('/api/cards?maxHp=-1');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid maxHp' });
    });

    it('returns 400 when minHp is greater than maxHp', async () => {
      const response = await request(app).get('/api/cards?minHp=150&maxHp=100');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'minHp cannot be greater than maxHp',
      });
    });

    it('returns 400 when page is zero', async () => {
      const response = await request(app).get('/api/cards?page=0');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid page' });
    });

    it('returns 400 when page is not an integer', async () => {
      const response = await request(app).get('/api/cards?page=1.5');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid page' });
    });

    it('returns 400 when limit is zero', async () => {
      const response = await request(app).get('/api/cards?limit=0');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid limit. Must be between 1 and 100',
      });
    });

    it('returns 400 when limit exceeds 100', async () => {
      const response = await request(app).get('/api/cards?limit=101');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid limit. Must be between 1 and 100',
      });
    });

    it('returns 400 when setId is not a positive integer', async () => {
      const response = await request(app).get('/api/cards?setId=abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid setId' });
    });

    it('returns 400 when setId is zero', async () => {
      const response = await request(app).get('/api/cards?setId=0');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid setId' });
    });

    it('returns 500 when retrieving cards fails', async () => {
      vi.spyOn(sequelize.connectionManager, 'getConnection').mockRejectedValueOnce(
        new Error('private SQL failure'),
      );
      const response = await request(app).get('/api/cards').expect(500);
      expect(response.body).toEqual({ error: 'Error retrieving cards' });
    });

    it.each([
      'search',
      'setId',
      'rarity',
      'category',
      'number',
      'artist',
      'type',
      'minHp',
      'maxHp',
    ])('filters real cards by %s independently', async (filter) => {
      const card = await createCard();
      const other = await createCard({
        name: 'Squirtle',
        number: '99',
        rarity: 'Common',
        category: 'Trainer',
        artist: 'Other',
        hp: 60,
        types: ['Water'],
        description: null,
      });
      const values: Record<string, string | number> = {
        search: 'chariZARD',
        setId: card.setId,
        rarity: 'Rare Holo',
        category: 'Pokemon',
        number: '4',
        artist: 'arita',
        type: 'Fire',
        minHp: 120,
        maxHp: 60,
      };
      const response = await request(app)
        .get('/api/cards')
        .query({ [filter]: values[filter] })
        .expect(200);
      expect(response.body.data.map((c: { id: number }) => c.id)).toEqual(
        filter === 'maxHp' ? [other.id] : [card.id],
      );
    });

    it.each(['4', 'arita', 'powerful'])(
      'searches every textual field with Op.or: %s',
      async (search) => {
        const card = await createCard();
        await createCard({ name: 'Squirtle', number: '99', artist: 'Other', description: null });
        const response = await request(app).get('/api/cards').query({ search }).expect(200);
        expect(response.body.data.map((c: { id: number }) => c.id)).toEqual([card.id]);
      },
    );

    it('keeps cards with no offers visible and returns correct empty pagination', async () => {
      const card = await createCard();
      const response = await request(app).get('/api/cards').expect(200);
      expect(response.body.data[0].id).toBe(card.id);
      const empty = await request(app).get('/api/cards?page=2&limit=1').expect(200);
      expect(empty.body.data).toEqual([]);
      expect(empty.body.pagination).toEqual({ page: 2, limit: 1, total: 1, totalPages: 1 });
    });
  });

  describe('GET /api/cards/:id', () => {
    it('returns a card with its set and available products', async () => {
      const card = await createCard();
      const { profile } = await createSellerWithProfile();
      const expensive = await createProduct({
        cardId: card.id,
        sellerProfileId: profile.id,
        price: 40,
      });
      const cheap = await createProduct({
        cardId: card.id,
        sellerProfileId: profile.id,
        price: 10,
      });
      await createProduct({ cardId: card.id, sellerProfileId: profile.id, isActive: false });
      await createProduct({ cardId: card.id, sellerProfileId: profile.id, stock: 0 });
      const inactive = await createSellerWithProfile({ isActive: false });
      await createProduct({ cardId: card.id, sellerProfileId: inactive.profile.id });
      const response = await request(app)
        .get('/api/cards/' + card.id)
        .expect(200);
      expect(response.body).toMatchObject({
        id: card.id,
        name: 'Charizard',
        set: { id: card.setId, name: 'Base Set' },
      });
      expect(response.body.products.map((p: { id: number }) => p.id)).toEqual([
        cheap.id,
        expensive.id,
      ]);
      expect(response.body.products[0].seller).toMatchObject({
        id: profile.id,
        storeName: profile.storeName,
      });
      expect(response.body.products[0].seller).not.toHaveProperty('userId');
    });

    it('returns 400 when the card ID is not numeric', async () => {
      const response = await request(app).get('/api/cards/abc').expect(400);
      expect(response.body).toEqual({ error: 'Invalid card id' });
    });

    it('returns 404 when the card does not exist', async () => {
      const response = await request(app).get('/api/cards/999999').expect(404);
      expect(response.body).toEqual({ error: 'Card not found' });
    });

    it('returns 500 when retrieving a card fails', async () => {
      vi.spyOn(sequelize.connectionManager, 'getConnection').mockRejectedValueOnce(
        new Error('private SQL failure'),
      );
      const response = await request(app).get('/api/cards/1').expect(500);
      expect(response.body).toEqual({ error: 'Error retrieving card' });
    });

    it('returns a card even if every associated offer is unavailable', async () => {
      const card = await createCard();
      const { profile } = await createSellerWithProfile({ isActive: false });
      await createProduct({ cardId: card.id, sellerProfileId: profile.id });
      const response = await request(app)
        .get('/api/cards/' + card.id)
        .expect(200);
      expect(response.body.products).toEqual([]);
    });
  });
});
