import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import redis from '../../../src/config/redis.js';
import sequelize from '../../helpers/testDatabase.js';
import { Card } from '../../../src/models/indexModel.js';
import { createCard } from '../../factories/cardFactory.js';
import { createSet } from '../../factories/setFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createToken, createUser } from '../../helpers/userTestHelpers.js';
import { mockTcgdexHttp } from '../../helpers/tcgdexHttp.js';
import { tcgdexCards, tcgdexSet } from '../../fixtures/tcgdex/catalog.js';

const listKeys = async () => {
  const result: string[] = [];
  for await (const keys of redis.scanIterator({ MATCH: 'cards:list:*', COUNT: 100 }))
    result.push(...keys);
  return result;
};

describe('Cards with isolated real Redis', () => {
  it('returns cached cards without querying PostgreSQL', async () => {
    const card = await createCard();
    expect(await listKeys()).toEqual([]);
    const write = vi.spyOn(redis, 'set');
    const miss = await request(app).get('/api/cards').expect(200);
    expect(miss.body.data[0].id).toBe(card.id);
    const keys = await listKeys();
    expect(keys).toHaveLength(1);
    expect(JSON.parse((await redis.get(keys[0]))!)).toEqual(miss.body);
    expect(write).toHaveBeenCalledWith(keys[0], expect.any(String), { EX: 300 });
    expect(await redis.ttl(keys[0])).toBeGreaterThan(0);
    expect(await redis.ttl(keys[0])).toBeLessThanOrEqual(300);
    const query = vi.spyOn(sequelize, 'query'); // Observe SQL; never replace it.
    const hit = await request(app).get('/api/cards').expect(200);
    expect(hit.body).toEqual(miss.body);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the cached card without querying PostgreSQL', async () => {
    const card = await createCard();
    const key = 'cards:detail:' + card.id;
    expect(await redis.exists(key)).toBe(0);
    const write = vi.spyOn(redis, 'set');
    const miss = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(miss.body.products).toEqual([]);
    expect(JSON.parse((await redis.get(key))!)).toEqual(miss.body);
    expect(write).toHaveBeenCalledWith(key, expect.any(String), { EX: 300 });
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(300);
    const query = vi.spyOn(sequelize, 'query');
    const hit = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(hit.body).toEqual(miss.body);
    expect(query).not.toHaveBeenCalled();
    await request(app).get('/api/cards/999999').expect(404);
    expect(await redis.exists('cards:detail:999999')).toBe(0);
  });

  it.each(['list', 'detail'] as const)(
    'falls back to PostgreSQL when reading the %s cache fails',
    async (route) => {
      const card = await createCard();
      const get = vi
        .spyOn(redis, 'get')
        .mockRejectedValueOnce(new Error('Redis transport unavailable'));
      const response = await request(app)
        .get(route === 'list' ? '/api/cards' : '/api/cards/' + card.id)
        .expect(200);
      expect(get).toHaveBeenCalled();
      expect((route === 'list' ? response.body.data[0] : response.body).id).toBe(card.id);
    },
  );

  it.each(['list', 'detail'] as const)(
    'keeps the %s HTTP response successful if a Redis write fails',
    async (route) => {
      const card = await createCard();
      const set = vi
        .spyOn(redis, 'set')
        .mockRejectedValueOnce(new Error('Redis transport unavailable'));
      const response = await request(app)
        .get(route === 'list' ? '/api/cards' : '/api/cards/' + card.id)
        .expect(200);
      expect(set).toHaveBeenCalled();
      expect((route === 'list' ? response.body.data[0] : response.body).id).toBe(card.id);
      expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
      expect(await listKeys()).toEqual([]);
    },
  );

  it.each(['list', 'detail'] as const)(
    'replaces malformed %s cache JSON using real data',
    async (route) => {
      const card = await createCard();
      const path = route === 'list' ? '/api/cards' : '/api/cards/' + card.id;
      await request(app).get(path).expect(200);
      const key = route === 'list' ? (await listKeys())[0] : 'cards:detail:' + card.id;
      await redis.set(key, '{invalid-json');
      await card.update({ name: 'Fresh Card' });
      const response = await request(app).get(path).expect(200);
      expect((route === 'list' ? response.body.data[0] : response.body).name).toBe('Fresh Card');
      expect(JSON.parse((await redis.get(key))!)).toEqual(response.body);
    },
  );

  it('uses separate list keys for filters and pagination', async () => {
    const card = await createCard();
    await createCard({ name: 'Blastoise' });
    await request(app).get('/api/cards').expect(200);
    const filtered = await request(app).get('/api/cards?search=Charizard').expect(200);
    const page = await request(app).get('/api/cards?page=2&limit=1').expect(200);
    expect(filtered.body.data.map((c: { id: number }) => c.id)).toEqual([card.id]);
    expect(page.body.data[0].name).toBe('Blastoise');
    expect(await listKeys()).toHaveLength(3);
  });

  it('filters an inactive seller out of an already cached card detail', async () => {
    const card = await createCard();
    const { profile } = await createSellerWithProfile();
    const product = await createProduct({ cardId: card.id, sellerProfileId: profile.id });
    const first = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(first.body.products[0].id).toBe(product.id);
    // Direct DB change deliberately bypasses invalidation to exercise the defensive cache-hit filter.
    await profile.update({ isActive: false });
    expect(await redis.exists('cards:detail:' + card.id)).toBe(1);
    const response = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(response.body.products).toEqual([]);
  });

  it('invalidates only affected details and all card lists after single-card synchronization', async () => {
    const set = await createSet({ tcgdexId: 'base1' });
    const card = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
    const other = await createCard();
    for (const path of [
      '/api/cards',
      '/api/cards?search=Original',
      '/api/cards/' + card.id,
      '/api/cards/' + other.id,
      '/api/sets/' + set.id,
    ]) {
      await request(app).get(path).expect(200);
    }
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    await request(app)
      .post('/api/cards/base1-4/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect((await card.reload()).name).toBe('Charizard');
    expect(await listKeys()).toEqual([]);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    expect(await redis.exists('sets:detail:' + set.id)).toBe(0);
    expect(await redis.exists('cards:detail:' + other.id)).toBe(1);
    const fresh = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(fresh.body.name).toBe('Charizard');
  });

  it('invalidates a batch only after its upserts are committed', async () => {
    const set = await createSet({ tcgdexId: 'base1' });
    const card = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
    await request(app).get('/api/cards').expect(200);
    await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    await request(app)
      .get('/api/sets/' + set.id)
      .expect(200);
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    const originalDel = redis.del.bind(redis);
    const committed: { count: number; name: string }[] = [];
    const del = vi.spyOn(redis, 'del').mockImplementation(async (...args) => {
      // This query uses a separate, non-transactional connection: it must see the entire committed batch.
      committed.push({
        count: await Card.count({ where: { setId: set.id } }),
        name: (await card.reload()).name,
      });
      return originalDel(...args);
    });
    await request(app)
      .post('/api/cards/set/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(del).toHaveBeenCalled();
    del.mockRestore();
    expect(committed.length).toBeGreaterThan(0);
    expect(
      committed.every((snapshot) => snapshot.count === 2 && snapshot.name === 'Charizard'),
    ).toBe(true);
    expect(await listKeys()).toEqual([]);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    expect(await redis.exists('sets:detail:' + set.id)).toBe(0);
  });

  it('keeps cached data unchanged when a real batch transaction rolls back', async () => {
    const set = await createSet({ tcgdexId: 'base1' });
    const card = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
    await request(app).get('/api/cards').expect(200);
    await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    const key = (await listKeys())[0];
    const cached = await redis.get(key);
    const detail = await redis.get('cards:detail:' + card.id);
    mockTcgdexHttp({
      '/sets/base1': tcgdexSet,
      '/cards/base1-4': tcgdexCards[0],
      '/cards/base1-2': { ...tcgdexCards[1], name: 'X'.repeat(151) },
    });
    const token = createToken(await createUser({ role: 'admin' }));
    await request(app)
      .post('/api/cards/set/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(502);
    expect((await card.reload()).name).toBe('Original');
    expect(await redis.get(key)).toBe(cached);
    expect(await redis.get('cards:detail:' + card.id)).toBe(detail);
  });
});
