import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import redis from '../../../src/config/redis.js';
import { Order, Product } from '../../../src/models/indexModel.js';
import { createCard } from '../../factories/cardFactory.js';
import { createPurchase, payPurchase } from '../../helpers/purchase.js';
import { failTransactionAt } from '../../helpers/transactionFailure.js';

describe('Order stock and real Redis invalidation', () => {
  it('invalidates affected offers only after payment commits and preserves unrelated details and lists', async () => {
    const purchase = await createPurchase();
    const product = purchase.products[0].product;
    const other = await createCard();
    await request(app)
      .get('/api/cards/' + product.cardId)
      .expect(200);
    await request(app)
      .get('/api/cards/' + other.id)
      .expect(200);
    await request(app).get('/api/cards').expect(200);
    const originalDel = redis.del.bind(redis);
    const committed: { status: string | undefined; stock: number | undefined }[] = [];
    const del = vi.spyOn(redis, 'del').mockImplementation(async (...args) => {
      // Independent reads see only committed values. The real DEL is still executed.
      committed.push({
        status: (await Order.findByPk(purchase.order.id))?.status,
        stock: (await Product.findByPk(product.id))?.stock,
      });
      return originalDel(...args);
    });
    await payPurchase(purchase);
    expect(del).toHaveBeenCalled();
    del.mockRestore();
    expect(committed.length).toBeGreaterThan(0);
    expect(committed.every((snapshot) => snapshot.status === 'paid' && snapshot.stock === 2)).toBe(
      true,
    );
    expect(await redis.exists('cards:detail:' + product.cardId)).toBe(0);
    expect(await redis.exists('cards:detail:' + other.id)).toBe(1);
    const listKeys: string[] = [];
    for await (const keys of redis.scanIterator({ MATCH: 'cards:list:*', COUNT: 100 }))
      listKeys.push(...keys);
    expect(listKeys).toHaveLength(1);
    const response = await request(app)
      .get('/api/cards/' + product.cardId)
      .expect(200);
    expect(response.body.products[0].stock).toBe(2);
  });

  it('does not invalidate offers or restore stock for pending cancellations', async () => {
    const purchase = await createPurchase();
    const product = purchase.products[0].product;
    const key = 'cards:detail:' + product.cardId;
    await request(app)
      .get('/api/cards/' + product.cardId)
      .expect(200);
    const before = await redis.get(key);
    const del = vi.spyOn(redis, 'del');
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(del).not.toHaveBeenCalled();
    expect((await product.reload()).stock).toBe(3);
    expect(await redis.get(key)).toBe(before);
  });

  it('invalidates restored offers after paid cancellation commits and not again on duplicate cancellation', async () => {
    const purchase = await payPurchase(await createPurchase());
    const product = purchase.products[0].product;
    const other = await createCard();
    await request(app)
      .get('/api/cards/' + product.cardId)
      .expect(200);
    await request(app)
      .get('/api/cards/' + other.id)
      .expect(200);
    const originalDel = redis.del.bind(redis);
    const committed: { status: string | undefined; stock: number | undefined }[] = [];
    const del = vi.spyOn(redis, 'del').mockImplementation(async (...args) => {
      committed.push({
        status: (await Order.findByPk(purchase.order.id))?.status,
        stock: (await Product.findByPk(product.id))?.stock,
      });
      return originalDel(...args);
    });
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(del).toHaveBeenCalled();
    expect(
      committed.every((snapshot) => snapshot.status === 'cancelled' && snapshot.stock === 3),
    ).toBe(true);
    expect(await redis.exists('cards:detail:' + product.cardId)).toBe(0);
    expect(await redis.exists('cards:detail:' + other.id)).toBe(1);
    const response = await request(app)
      .get('/api/cards/' + product.cardId)
      .expect(200);
    expect(response.body.products[0].stock).toBe(3);
    del.mockClear();
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(409);
    expect(del).not.toHaveBeenCalled();
    expect(await redis.exists('cards:detail:' + product.cardId)).toBe(1);
  });

  it.each(['pay', 'cancel'] as const)(
    'preserves cached offers when %s rolls back after a real SQL failure',
    async (operation) => {
      const purchase = await createPurchase();
      if (operation === 'cancel') await payPurchase(purchase);
      const product = purchase.products[0].product;
      const key = 'cards:detail:' + product.cardId;
      await request(app)
        .get('/api/cards/' + product.cardId)
        .expect(200);
      const before = await redis.get(key);
      const failure = failTransactionAt('notification');
      const del = vi.spyOn(redis, 'del');
      try {
        await request(app)
          .post(`/api/orders/${purchase.order.id}/${operation}`)
          .set('Authorization', 'Bearer ' + purchase.token)
          .expect(500);
        expect(failure.state.calls).toBe(1);
        expect(failure.state.transactionId).not.toBe('');
      } finally {
        failure.remove();
      }
      expect(del).not.toHaveBeenCalled();
      expect(await redis.get(key)).toBe(before);
      expect((await product.reload()).stock).toBe(operation === 'pay' ? 3 : 2);
      expect((await purchase.order.reload()).status).toBe(operation === 'pay' ? 'pending' : 'paid');
    },
  );
});
