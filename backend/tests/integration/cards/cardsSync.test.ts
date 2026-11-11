import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Card } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createSet } from '../../factories/setFactory.js';
import { createCard } from '../../factories/cardFactory.js';
import { mockTcgdexHttp } from '../../helpers/tcgdexHttp.js';
import { tcgdexCards, tcgdexSet } from '../../fixtures/tcgdex/catalog.js';

const prepare = async () => {
  const user = await createUser({ role: 'admin' });
  const set = await createSet({ tcgdexId: 'base1' });
  const http = mockTcgdexHttp();
  return { token: createToken(user), set, http };
};

describe('Cards synchronization', () => {
  describe('POST /api/cards/:id/sync', () => {
    it('synchronizes a card and returns 201', async () => {
      const { token, set, http } = await prepare();
      const response = await request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      expect(response.body).toMatchObject({
        tcgdexId: 'base1-4',
        setId: set.id,
        name: 'Charizard',
        number: '4',
        rarity: 'Rare Holo',
        imageUrl: tcgdexCards[0].image + '/high.webp',
        hp: 120,
        artist: 'Mitsuhiro Arita',
        types: ['Fire'],
      });
      const card = await Card.findByPk(response.body.id);
      expect(card?.toJSON()).toMatchObject({ name: 'Charizard', setId: set.id, hp: 120 });
      expect(http).toHaveBeenCalledTimes(1);
      expect(http.mock.calls[0][0]).toBe('https://api.tcgdex.net/v2/en/cards/base1-4');
    });

    it('returns 502 when synchronization with TCGdex fails', async () => {
      const { token, http } = await prepare();
      http.mockRejectedValueOnce(new TypeError('Connection refused'));
      const response = await request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(502);
      expect(response.body).toEqual({ error: 'Error syncing card with TCGdex' });
      expect(await Card.count()).toBe(0);
    });

    it('updates the same row on repeated synchronization and maps missing fields to null', async () => {
      const { token } = await prepare();
      const first = await request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      mockTcgdexHttp({
        '/cards/base1-4': {
          id: 'base1-4',
          localId: '4',
          name: 'Updated Charizard',
          set: tcgdexCards[0].set,
        },
      });
      const second = await request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      expect(second.body).toMatchObject({
        id: first.body.id,
        name: 'Updated Charizard',
        hp: null,
        types: null,
        imageUrl: null,
      });
      expect(await Card.count()).toBe(1);
      expect((await Card.findByPk(first.body.id))?.name).toBe('Updated Charizard');
    });

    it('fails without writing a card if its expansion is not present locally', async () => {
      const user = await createUser({ role: 'admin' });
      mockTcgdexHttp();
      await request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(502);
      expect(await Card.count()).toBe(0);
    });

    it.each(['http', 'json'] as const)(
      'handles an external %s failure without changing existing data',
      async (failure) => {
        const { token, set, http } = await prepare();
        const card = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
        http.mockResolvedValueOnce(
          failure === 'http'
            ? new Response('Unavailable', { status: 503 })
            : new Response('{invalid', { status: 200 }),
        );
        await request(app)
          .post('/api/cards/base1-4/sync')
          .set('Authorization', 'Bearer ' + token)
          .expect(502);
        expect((await card.reload()).name).toBe('Original');
        expect(await Card.count()).toBe(1);
      },
    );

    it('aborts a TCGdex request at the configured 10 second deadline without writes', async () => {
      const { token } = await prepare();
      let notifyStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        notifyStarted = resolve;
      });
      let abort: (() => void) | undefined;
      // Trigger the actual timeout branch without waiting ten seconds or faking HTTP/server clocks.
      const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
        const controller = new AbortController();
        abort = () => controller.abort(new DOMException('Timed out', 'TimeoutError'));
        return controller.signal;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(
          async (_url, options) =>
            new Promise<Response>((_resolve, reject) => {
              options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), {
                once: true,
              });
              notifyStarted();
            }),
        ),
      );
      const pending = request(app)
        .post('/api/cards/base1-4/sync')
        .set('Authorization', 'Bearer ' + token)
        .then((response) => response);
      await started;
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(abort).toBeTypeOf('function');
      abort!();
      const response = await pending;
      expect(response.status).toBe(502);
      expect(response.body).toEqual({ error: 'Error syncing card with TCGdex' });
      expect(await Card.count()).toBe(0);
    });
  });

  describe('POST /api/cards/set/:id/sync', () => {
    it('synchronizes all cards belonging to a set', async () => {
      const { token, set } = await prepare();
      const response = await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      expect(response.body.set).toBe('Base Set');
      expect(response.body.cards.map((card: { tcgdexId: string }) => card.tcgdexId)).toEqual([
        'base1-4',
        'base1-2',
      ]);
      expect(await Card.count({ where: { setId: set.id } })).toBe(2);
      const blastoise = await Card.findOne({ where: { tcgdexId: 'base1-2' } });
      expect(blastoise?.imageUrl).toBe(tcgdexCards[1].image);
    });

    it('returns the total number of synchronized cards', async () => {
      const { token } = await prepare();
      const response = await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      expect(response.body.total).toBe(2);
      expect(response.body.cards).toHaveLength(2);
      expect(await Card.count()).toBe(2);
    });

    it('returns 502 when synchronizing the set fails', async () => {
      const { token, http } = await prepare();
      http.mockRejectedValueOnce(new TypeError('Unavailable'));
      const response = await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(502);
      expect(response.body).toEqual({ error: 'Error syncing cards with TCGdex' });
      expect(await Card.count()).toBe(0);
    });

    it('downloads the entire batch before writing when the last HTTP request fails', async () => {
      const { token, set, http } = await prepare();
      const original = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
      http
        .mockImplementationOnce(async () => Response.json(tcgdexSet))
        .mockImplementationOnce(async () => Response.json(tcgdexCards[0]))
        .mockRejectedValueOnce(new TypeError('Last card unavailable'));
      await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(502);
      expect((await original.reload()).name).toBe('Original');
      expect(await Card.count()).toBe(1);
    });

    it('rolls back earlier upserts if a later card violates a PostgreSQL constraint', async () => {
      const { token, set } = await prepare();
      const original = await createCard({ setId: set.id, tcgdexId: 'base1-4', name: 'Original' });
      mockTcgdexHttp({
        '/sets/base1': tcgdexSet,
        '/cards/base1-4': tcgdexCards[0],
        '/cards/base1-2': { ...tcgdexCards[1], name: 'X'.repeat(151) },
      });
      await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(502);
      expect((await original.reload()).name).toBe('Original');
      expect(await Card.count()).toBe(1);
    });

    it('is idempotent for an entire batch', async () => {
      const { token } = await prepare();
      const first = await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      const second = await request(app)
        .post('/api/cards/set/base1/sync')
        .set('Authorization', 'Bearer ' + token)
        .expect(201);
      expect(second.body.cards.map((c: { id: number }) => c.id)).toEqual(
        first.body.cards.map((c: { id: number }) => c.id),
      );
      expect(await Card.count()).toBe(2);
    });
  });

  it.each(['/api/cards/base1-4/sync', '/api/cards/set/base1/sync'])(
    'requires an administrator at %s',
    async (path) => {
      const http = mockTcgdexHttp();
      await request(app).post(path).expect(401);
      for (const role of ['customer', 'seller'] as const) {
        const user = await createUser({ role });
        await request(app)
          .post(path)
          .set('Authorization', 'Bearer ' + createToken(user))
          .expect(403);
      }
      expect(http).not.toHaveBeenCalled();
      expect(await Card.count()).toBe(0);
    },
  );

  it.each(['/api/cards/base1-4/sync', '/api/cards/set/base1/sync'])(
    'rejects a banned administrator at %s before external HTTP',
    async (path) => {
      const http = mockTcgdexHttp();
      const user = await createUser({ role: 'admin', isBanned: true });
      const response = await request(app)
        .post(path)
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(403);
      expect(response.body).toEqual({ error: 'User account is banned' });
      expect(http).not.toHaveBeenCalled();
      expect(await Card.count()).toBe(0);
    },
  );

  it('returns an empty batch without inventing cards when TCGdex lists no cards', async () => {
    const { token } = await prepare();
    mockTcgdexHttp({ '/sets/base1': { ...tcgdexSet, cards: [] } });
    const response = await request(app)
      .post('/api/cards/set/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(response.body).toEqual({ set: 'Base Set', total: 0, cards: [] });
    expect(await Card.count()).toBe(0);
  });

  it('rejects a batch with a missing card list before any writes', async () => {
    const { token } = await prepare();
    mockTcgdexHttp({ '/sets/base1': { id: 'base1', name: 'Base Set' } });
    await request(app)
      .post('/api/cards/set/base1/sync')
      .set('Authorization', 'Bearer ' + token)
      .expect(502);
    expect(await Card.count()).toBe(0);
  });
});
