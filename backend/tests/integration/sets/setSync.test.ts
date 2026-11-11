import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Set } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { mockTcgdexHttp } from '../../helpers/tcgdexHttp.js';
import { tcgdexSet } from '../../fixtures/tcgdex/catalog.js';

describe('Sets synchronization', () => {
  it('synchronizes a set and returns 201', async () => {
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    const response = await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(response.body).toMatchObject({
      tcgdexId: 'base1',
      name: 'Base Set',
      series: 'Base',
      totalCards: 102,
      releaseDate: '1999-01-09',
      logoUrl: tcgdexSet.logo + '.webp',
      symbolUrl: tcgdexSet.symbol,
    });
    expect((await Set.findByPk(response.body.id))?.name).toBe('Base Set');
  });

  it('returns 502 when synchronization fails', async () => {
    const token = createToken(await createUser({ role: 'admin' }));
    const http = mockTcgdexHttp();
    http.mockRejectedValueOnce(new TypeError('Connection refused'));
    const response = await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(502);
    expect(response.body).toEqual({
      error: 'Error syncing set with TCGdex or invalidating its cache',
    });
    expect(await Set.count()).toBe(0);
  });

  it('updates an existing expansion without duplicates and maps absent fields to null', async () => {
    const token = createToken(await createUser({ role: 'admin' }));
    mockTcgdexHttp();
    const first = await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    mockTcgdexHttp({ '/sets/base1': { id: 'base1', name: 'Updated Base' } });
    const second = await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(second.body).toMatchObject({
      id: first.body.id,
      name: 'Updated Base',
      logoUrl: null,
      symbolUrl: null,
      totalCards: null,
      series: null,
      releaseDate: null,
    });
    expect(await Set.count()).toBe(1);
    expect((await Set.findByPk(first.body.id))?.name).toBe('Updated Base');
  });

  it.each(['http', 'json', 'constraint'] as const)(
    'does not change the existing set on %s failure',
    async (failure) => {
      const token = createToken(await createUser({ role: 'admin' }));
      const http = mockTcgdexHttp();
      const first = await request(app)
        .post('/api/sets/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      http.mockResolvedValueOnce(
        failure === 'http'
          ? new Response('Unavailable', { status: 503 })
          : failure === 'json'
            ? new Response('{invalid')
            : Response.json({ ...tcgdexSet, name: 'X'.repeat(151) }),
      );
      await request(app)
        .post('/api/sets/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(502);
      expect((await Set.findByPk(first.body.id))?.name).toBe('Base Set');
      expect(await Set.count()).toBe(1);
    },
  );

  it('requires administrative authentication before external HTTP or writes', async () => {
    const http = mockTcgdexHttp();
    await request(app).post('/api/sets/base1/sync').expect(401);
    for (const role of ['customer', 'seller'] as const) {
      const user = await createUser({ role });
      await request(app)
        .post('/api/sets/base1/sync')
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(403);
    }
    expect(http).not.toHaveBeenCalled();
    expect(await Set.count()).toBe(0);
  });

  it('rejects a banned administrator without calling TCGdex or writing sets', async () => {
    const http = mockTcgdexHttp();
    const user = await createUser({ role: 'admin', isBanned: true });
    await request(app)
      .post('/api/sets/base1/sync')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(403);
    expect(http).not.toHaveBeenCalled();
    expect(await Set.count()).toBe(0);
  });
});
