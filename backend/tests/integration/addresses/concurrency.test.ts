import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { ShippingAddress } from '../../../src/models/indexModel.js';
import {
  shippingAddressSnapshot,
  createShippingAddress,
} from '../../factories/shippingAddressFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { withOrderRowLock } from '../../helpers/orderConcurrency.js';

describe('Concurrent default shipping addresses', () => {
  it.each([undefined, true, false])(
    'serializes two first-address creations with isDefault=%s',
    async (isDefault) => {
      const user = await createUser();
      const token = createToken(user);
      const foreign = await createShippingAddress((await createUser()).id);
      const responses = await withOrderRowLock('users', user.id, async (gate) => {
        for (const recipientName of ['First Recipient', 'Second Recipient'])
          gate.start(
            request(app)
              .post('/api/shipping-addresses')
              .set('Authorization', 'Bearer ' + token)
              .send({ ...shippingAddressSnapshot, recipientName, isDefault }),
          );
        await gate.waitForBlocked(2);
      });
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(await ShippingAddress.count({ where: { userId: user.id } })).toBe(2);
      expect(await ShippingAddress.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
      expect((await foreign.reload()).isDefault).toBe(true);
    },
    15_000,
  );

  it('serializes two explicit replacements of an existing default', async () => {
    const user = await createUser();
    const old = await createShippingAddress(user.id);
    const responses = await withOrderRowLock('users', user.id, async (gate) => {
      for (const recipientName of ['New First', 'New Second'])
        gate.start(
          request(app)
            .post('/api/shipping-addresses')
            .set('Authorization', 'Bearer ' + createToken(user))
            .send({ ...shippingAddressSnapshot, recipientName, isDefault: true }),
        );
      await gate.waitForBlocked(2);
    });
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await ShippingAddress.count({ where: { userId: user.id } })).toBe(3);
    expect(await ShippingAddress.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
    expect((await old.reload()).isDefault).toBe(false);
  }, 15_000);

  it('serializes creation against selection of another default', async () => {
    const user = await createUser();
    await createShippingAddress(user.id);
    const other = await createShippingAddress(user.id, { isDefault: false });
    const token = createToken(user);
    const responses = await withOrderRowLock('users', user.id, async (gate) => {
      gate.start(
        request(app)
          .post('/api/shipping-addresses')
          .set('Authorization', 'Bearer ' + token)
          .send({ ...shippingAddressSnapshot, isDefault: true }),
      );
      gate.start(
        request(app)
          .patch(`/api/shipping-addresses/${other.id}/default`)
          .set('Authorization', 'Bearer ' + token),
      );
      await gate.waitForBlocked(2);
    });
    expect(responses.map((response) => response.status)).toEqual([201, 200]);
    expect(await ShippingAddress.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
  }, 15_000);

  it('preserves explicit false without electing a replacement on edit', async () => {
    const user = await createUser();
    const token = createToken(user);
    const first = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ ...shippingAddressSnapshot, isDefault: false })
      .expect(201);
    expect(first.body.isDefault).toBe(true);
    const second = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ ...shippingAddressSnapshot, isDefault: false })
      .expect(201);
    expect(second.body.isDefault).toBe(false);
    await request(app)
      .patch('/api/shipping-addresses/' + first.body.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ isDefault: false })
      .expect(200);
    expect(await ShippingAddress.count({ where: { userId: user.id, isDefault: true } })).toBe(0);
  });
});
