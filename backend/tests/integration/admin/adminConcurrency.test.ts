import { setImmediate } from 'node:timers/promises';
import { QueryTypes } from 'sequelize';
import { describe, expect, it } from 'vitest';
import request, { type Response } from 'supertest';
import app from '../../../src/app.js';
import { Notification, SellerProfile } from '../../../src/models/indexModel.js';
import sequelize from '../../helpers/testDatabase.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createPurchase } from '../../helpers/purchase.js';

const observe = (req: request.Test) =>
  req.timeout({ response: 8_000, deadline: 9_000 }).then(
    (value): PromiseFulfilledResult<Response> => ({ status: 'fulfilled', value }),
    (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
  );
const value = (result: PromiseSettledResult<Response>) => {
  if (result.status === 'rejected') throw result.reason;
  return result.value;
};

describe('Administrative deactivation versus payment', () => {
  it('rejects an in-flight payment if deactivation commits before its seller validation', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
    const adminToken = createToken(await createUser({ role: 'admin' }));
    let ready!: () => void;
    let release!: () => void;
    const reached = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const name = 'test-before-seller-payment-check';
    SellerProfile.addHook('beforeFind', name, async (options) => {
      if (!options.transaction) return;
      await sequelize.query(
        "SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='10s'",
        { transaction: options.transaction },
      );
      ready();
      await gate;
    });
    const payment = observe(
      request(app)
        .post(`/api/orders/${purchase.order.id}/pay`)
        .set('Authorization', 'Bearer ' + purchase.token),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome: PromiseSettledResult<Response>;
    try {
      await Promise.race([
        reached,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Payment did not reach seller validation')),
            2_500,
          );
        }),
      ]);
      await request(app)
        .patch(`/api/admin/sellers/${seller.profile.id}/status`)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ isActive: false })
        .timeout({ response: 4_000, deadline: 5_000 })
        .expect(200);
    } finally {
      release();
      if (timer) clearTimeout(timer);
      try {
        outcome = await payment;
      } finally {
        SellerProfile.removeHook('beforeFind', name);
      }
    }
    expect(value(outcome).status).toBe(403);
    expect((await seller.profile.reload()).isActive).toBe(false);
    expect((await purchase.order.reload()).status).toBe('pending');
    expect((await product.reload()).stock).toBe(3);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(0);
  }, 15_000);

  it('lets an already locked payment commit before the competing administrative UPDATE', async () => {
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
    const adminToken = createToken(await createUser({ role: 'admin' }));
    let ready!: () => void;
    let release!: () => void;
    let paymentPid = 0;
    const reached = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const name = 'test-payment-before-notification';
    Notification.addHook('beforeCreate', name, async (notification, options) => {
      if (notification.get('type') !== 'NEW_SALE') return;
      if (!options.transaction) throw new Error('Payment notification must be transactional');
      await sequelize.query(
        "SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='10s'",
        { transaction: options.transaction },
      );
      const [row] = await sequelize.query<{ pid: number }>('SELECT pg_backend_pid() AS pid', {
        transaction: options.transaction,
        type: QueryTypes.SELECT,
      });
      paymentPid = row.pid;
      ready();
      await gate;
    });
    const jobs = [
      observe(
        request(app)
          .post(`/api/orders/${purchase.order.id}/pay`)
          .set('Authorization', 'Bearer ' + purchase.token),
      ),
    ];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcomes: PromiseSettledResult<Response>[];
    try {
      await Promise.race([
        reached,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Payment did not reach the transactional notification')),
            2_500,
          );
        }),
      ]);
      jobs.push(
        observe(
          request(app)
            .patch(`/api/admin/sellers/${seller.profile.id}/status`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ isActive: false }),
        ),
      );
      const deadline = performance.now() + 2_500;
      let blocked = false;
      do {
        const rows = await sequelize.query<{ pid: number }>(
          'SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND :root = ANY(pg_blocking_pids(pid))',
          { replacements: { root: paymentPid }, type: QueryTypes.SELECT },
        );
        if (rows.length > 0) {
          blocked = true;
          break;
        }
        await setImmediate();
      } while (performance.now() < deadline);
      expect(blocked).toBe(true);
    } finally {
      release();
      if (timer) clearTimeout(timer);
      try {
        outcomes = await Promise.all(jobs);
      } finally {
        Notification.removeHook('beforeCreate', name);
      }
    }
    expect(outcomes.map((result) => value(result).status)).toEqual([200, 200]);
    expect((await purchase.order.reload()).status).toBe('paid');
    expect((await product.reload()).stock).toBe(2);
    expect((await seller.profile.reload()).isActive).toBe(false);
    expect(await Notification.count({ where: { type: 'NEW_SALE' } })).toBe(1);
  }, 15_000);
});
