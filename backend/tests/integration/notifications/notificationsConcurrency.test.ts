import { describe, expect, it } from 'vitest';
import request, { type Response } from 'supertest';
import app from '../../../src/app.js';
import { Notification } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createNotification } from '../../factories/notificationFactory.js';

describe('Concurrent notification reads', () => {
  it.each(['individual', 'bulk', 'mixed'] as const)(
    'keeps %s read operations monotonic, idempotent and isolated',
    async (scenario) => {
      const user = await createUser();
      const first = await createNotification(user.id);
      const second = await createNotification(user.id);
      const foreign = await createNotification((await createUser()).id);
      const token = createToken(user);
      let count = 0;
      let ready!: () => void;
      let release!: () => void;
      const both = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const arrive = async () => {
        if (++count === 2) ready();
        await gate;
      };
      const name = 'test-notification-writes';
      Notification.addHook('beforeUpdate', name, arrive);
      Notification.addHook('beforeBulkUpdate', name, arrive);
      const modes =
        scenario === 'individual'
          ? ['individual', 'individual']
          : scenario === 'bulk'
            ? ['bulk', 'bulk']
            : ['individual', 'bulk'];
      const jobs = modes.map((mode) =>
        request(app)
          .patch(
            mode === 'bulk' ? '/api/notifications/read-all' : `/api/notifications/${first.id}/read`,
          )
          .set('Authorization', 'Bearer ' + token)
          .timeout({ response: 8_000, deadline: 9_000 })
          .then(
            (value): PromiseFulfilledResult<Response> => ({ status: 'fulfilled', value }),
            (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
          ),
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      let results: PromiseSettledResult<Response>[];
      try {
        await Promise.race([
          both,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Notification writes did not overlap')),
              2_500,
            );
          }),
        ]);
      } finally {
        release();
        if (timer) clearTimeout(timer);
        try {
          results = await Promise.all(jobs);
        } finally {
          Notification.removeHook('beforeUpdate', name);
          Notification.removeHook('beforeBulkUpdate', name);
        }
      }
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map((r) => r.reason));
      const responses = results.map((r) => (r as PromiseFulfilledResult<Response>).value);
      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      expect((await first.reload()).isRead).toBe(true);
      expect((await second.reload()).isRead).toBe(scenario !== 'individual');
      expect((await foreign.reload()).isRead).toBe(false);
      expect(await Notification.count()).toBe(3);
      const unread = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);
      expect(unread.body.count).toBe(scenario === 'individual' ? 1 : 0);
      if (scenario === 'bulk')
        expect(responses.map((r) => r.body.updatedCount).sort()).toEqual([0, 2]);
      if (scenario === 'mixed') expect([1, 2]).toContain(responses[1].body.updatedCount);
      expect((await first.reload()).message).toBe('Testing message');
    },
    15_000,
  );
});
