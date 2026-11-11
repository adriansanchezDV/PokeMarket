import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import redis from '../../../src/config/redis.js';
import sequelize from '../../helpers/testDatabase.js';
import { createSet } from '../../factories/setFactory.js';
import { createCard } from '../../factories/cardFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { mockTcgdexHttp } from '../../helpers/tcgdexHttp.js';
import { tcgdexSet } from '../../fixtures/tcgdex/catalog.js';

describe('Sets with isolated real Redis', () => {
  it('returns cached sets without querying PostgreSQL', async () => {
    const set = await createSet();
    expect(await redis.exists('sets:list')).toBe(0);
    const write = vi.spyOn(redis, 'set');
    const miss = await request(app).get('/api/sets').expect(200);
    expect(miss.body[0].id).toBe(set.id);
    expect(JSON.parse((await redis.get('sets:list'))!)).toEqual(miss.body);
    expect(write).toHaveBeenCalledWith('sets:list', expect.any(String), { EX: 300 });
    expect(await redis.ttl('sets:list')).toBeGreaterThan(0);
    expect(await redis.ttl('sets:list')).toBeLessThanOrEqual(300);
    const query = vi.spyOn(sequelize, 'query');
    const hit = await request(app).get('/api/sets').expect(200);
    expect(hit.body).toEqual(miss.body);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the cached set without querying PostgreSQL', async () => {
    const set = await createSet();
    const key = 'sets:detail:' + set.id;
    const write = vi.spyOn(redis, 'set');
    const miss = await request(app)
      .get('/api/sets/' + set.id)
      .expect(200);
    expect(JSON.parse((await redis.get(key))!)).toEqual(miss.body);
    expect(write).toHaveBeenCalledWith(key, expect.any(String), { EX: 300 });
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(300);
    const query = vi.spyOn(sequelize, 'query');
    const hit = await request(app)
      .get('/api/sets/' + set.id)
      .expect(200);
    expect(hit.body).toEqual(miss.body);
    expect(query).not.toHaveBeenCalled();
    await request(app).get('/api/sets/999999').expect(404);
    expect(await redis.exists('sets:detail:999999')).toBe(0);
  });

  it.each(['list', 'detail'] as const)(
    'falls back to PostgreSQL when reading the %s cache fails',
    async (route) => {
      const set = await createSet();
      const get = vi
        .spyOn(redis, 'get')
        .mockRejectedValueOnce(new Error('Redis transport unavailable'));
      const response = await request(app)
        .get(route === 'list' ? '/api/sets' : '/api/sets/' + set.id)
        .expect(200);
      expect(get).toHaveBeenCalled();
      expect((route === 'list' ? response.body[0] : response.body).id).toBe(set.id);
    },
  );

  it.each(['list', 'detail'] as const)(
    'returns %s data even if writing Redis fails',
    async (route) => {
      const set = await createSet();
      const write = vi
        .spyOn(redis, 'set')
        .mockRejectedValueOnce(new Error('Redis transport unavailable'));
      const response = await request(app)
        .get(route === 'list' ? '/api/sets' : '/api/sets/' + set.id)
        .expect(200);
      expect(write).toHaveBeenCalled();
      expect((route === 'list' ? response.body[0] : response.body).id).toBe(set.id);
      expect(await redis.exists(route === 'list' ? 'sets:list' : 'sets:detail:' + set.id)).toBe(0);
    },
  );

  it.each(['list', 'detail'] as const)('recovers from malformed %s cache JSON', async (route) => {
    const set = await createSet();
    const key = route === 'list' ? 'sets:list' : 'sets:detail:' + set.id;
    await redis.set(key, '{invalid');
    const response = await request(app)
      .get(route === 'list' ? '/api/sets' : '/api/sets/' + set.id)
      .expect(200);
    expect((route === 'list' ? response.body[0] : response.body).id).toBe(set.id);
    expect(JSON.parse((await redis.get(key))!)).toEqual(response.body);
  });

  it('invalidates the sets cache after a successful synchronization', async () => {
    const set = await createSet({ tcgdexId: 'base1', name: 'Original' });
    const card = await createCard({ setId: set.id });
    const otherSet = await createSet();
    const otherCard = await createCard({ setId: otherSet.id });
    for (const path of [
      '/api/sets',
      '/api/sets/' + set.id,
      '/api/sets/' + otherSet.id,
      '/api/cards/' + card.id,
      '/api/cards/' + otherCard.id,
    ]) {
      await request(app).get(path).expect(200);
    }
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect((await set.reload()).name).toBe('Base Set');
    expect(await redis.exists('sets:list')).toBe(0);
    expect(await redis.exists('sets:detail:' + set.id)).toBe(0);
    expect(await redis.exists('cards:detail:' + card.id)).toBe(0);
    expect(await redis.exists('sets:detail:' + otherSet.id)).toBe(1);
    expect(await redis.exists('cards:detail:' + otherCard.id)).toBe(1);
    const fresh = await request(app)
      .get('/api/cards/' + card.id)
      .expect(200);
    expect(fresh.body.set.name).toBe('Base Set');
  });

  it('commits synchronization even if cache invalidation fails, documenting the TTL limitation', async () => {
    const set = await createSet({ tcgdexId: 'base1', name: 'Original' });
    await request(app).get('/api/sets').expect(200);
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    const del = vi
      .spyOn(redis, 'del')
      .mockRejectedValueOnce(new Error('Redis transport unavailable'));
    await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(del).toHaveBeenCalled();
    expect((await set.reload()).name).toBe('Base Set');
    // Current production behavior: failed invalidation leaves the old entry until it expires.
    expect(JSON.parse((await redis.get('sets:list'))!)[0].name).toBe('Original');
    expect(await redis.ttl('sets:list')).toBeGreaterThan(0);
  });

  it('does not invalidate cached data when TCGdex fails before the upsert', async () => {
    const set = await createSet({ tcgdexId: 'base1' });
    await request(app).get('/api/sets').expect(200);
    const before = await redis.get('sets:list');
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp().mockRejectedValueOnce(new TypeError('Connection refused'));
    await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(502);
    expect(await redis.get('sets:list')).toBe(before);
    expect((await set.reload()).name).toBe('Base Set');
  });

  it('updates a cached detail after the external expansion name changes', async () => {
    const set = await createSet({ tcgdexId: 'base1' });
    await request(app)
      .get('/api/sets/' + set.id)
      .expect(200);
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp({ '/sets/base1': { ...tcgdexSet, name: 'Updated Expansion' } });
    await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    const response = await request(app)
      .get('/api/sets/' + set.id)
      .expect(200);
    expect(response.body.name).toBe('Updated Expansion');
    expect(JSON.parse((await redis.get('sets:detail:' + set.id))!).name).toBe('Updated Expansion');
  });
});
