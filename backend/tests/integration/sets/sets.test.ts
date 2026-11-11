import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import sequelize from '../../helpers/testDatabase.js';
import { createSet } from '../../factories/setFactory.js';
import { createCard } from '../../factories/cardFactory.js';

describe('Sets API', () => {
  describe('GET /api/sets', () => {
    it('returns all sets when the cache is empty', async () => {
      const old = await createSet();
      const recent = await createSet({ name: '151', releaseDate: '2023-09-22' });
      const response = await request(app).get('/api/sets').expect(200);
      expect(response.body.map((s: { id: number }) => s.id)).toEqual([recent.id, old.id]);
      expect(response.body[0].name).toBe('151');
    });

    it('returns 500 when retrieving sets fails', async () => {
      vi.spyOn(sequelize.connectionManager, 'getConnection').mockRejectedValueOnce(
        new Error('private SQL failure'),
      );
      const response = await request(app).get('/api/sets').expect(500);
      expect(response.body).toEqual({ error: 'Error retrieving sets' });
    });

    it('returns an empty list when no expansions exist', async () => {
      const response = await request(app).get('/api/sets').expect(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/sets/:id', () => {
    it('returns a set when it exists', async () => {
      const set = await createSet();
      const card = await createCard({ setId: set.id });
      await createCard();
      const response = await request(app)
        .get('/api/sets/' + set.id)
        .expect(200);
      expect(response.body).toMatchObject({ id: set.id, tcgdexId: set.tcgdexId, name: 'Base Set' });
      expect(response.body.cards).toHaveLength(1);
      expect(response.body.cards[0]).toMatchObject({
        id: card.id,
        name: 'Charizard',
        number: '4',
        rarity: 'Rare Holo',
      });
    });

    it('returns 400 when the ID is not numeric', async () => {
      const response = await request(app).get('/api/sets/abc').expect(400);
      expect(response.body).toEqual({ error: 'Invalid set id' });
    });
    it('returns 400 when the ID is zero', async () => {
      await request(app).get('/api/sets/0').expect(400);
    });
    it('returns 400 when the ID is negative', async () => {
      await request(app).get('/api/sets/-1').expect(400);
    });
    it('returns 404 when the set does not exist', async () => {
      const response = await request(app).get('/api/sets/999999').expect(404);
      expect(response.body).toEqual({ error: 'Set not found' });
    });
    it('returns 500 when retrieving a set fails', async () => {
      vi.spyOn(sequelize.connectionManager, 'getConnection').mockRejectedValueOnce(
        new Error('private SQL failure'),
      );
      const response = await request(app).get('/api/sets/1').expect(500);
      expect(response.body).toEqual({ error: 'Error retrieving set' });
    });
    it('returns a set with no cards', async () => {
      const set = await createSet();
      const response = await request(app)
        .get('/api/sets/' + set.id)
        .expect(200);
      expect(response.body.cards).toEqual([]);
    });
  });
});
