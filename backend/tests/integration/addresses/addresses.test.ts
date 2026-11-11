import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { ShippingAddress } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import {
  createShippingAddress,
  shippingAddressSnapshot,
} from '../../factories/shippingAddressFactory.js';

describe('Shipping addresses', () => {
  it('returns an empty list for a user without addresses', async () => {
    const token = createToken(await createUser());
    const response = await request(app)
      .get('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toEqual([]);
    expect(await ShippingAddress.count()).toBe(0);
  });

  it('creates and trims an address for the authenticated user, making the first one default', async () => {
    const user = await createUser();
    const response = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + createToken(user))
      .send({
        ...shippingAddressSnapshot,
        recipientName: '  Test Buyer  ',
        isDefault: false,
        userId: 999999,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      ...shippingAddressSnapshot,
      userId: user.id,
      isDefault: true,
    });
    expect((await ShippingAddress.findByPk(response.body.id))?.toJSON()).toMatchObject({
      userId: user.id,
      isDefault: true,
      recipientName: 'Test Buyer',
    });
  });

  it('keeps the current default for an additional address unless explicitly changed', async () => {
    const user = await createUser();
    const first = await createShippingAddress(user.id);
    const token = createToken(user);
    const second = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ ...shippingAddressSnapshot, street: 'Second Street' })
      .expect(201);
    expect(second.body.isDefault).toBe(false);
    const third = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ ...shippingAddressSnapshot, street: 'Third Street', isDefault: true })
      .expect(201);
    expect(third.body.isDefault).toBe(true);
    expect((await first.reload()).isDefault).toBe(false);
    expect(await ShippingAddress.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
    const list = await request(app)
      .get('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(list.body[0].id).toBe(third.body.id);
  });

  it('reads, updates and changes the default without affecting another account', async () => {
    const user = await createUser();
    const first = await createShippingAddress(user.id);
    const second = await createShippingAddress(user.id, { isDefault: false });
    const other = await createShippingAddress((await createUser()).id);
    const token = createToken(user);
    const detail = await request(app)
      .get('/api/shipping-addresses/' + second.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(detail.body.id).toBe(second.id);
    const updated = await request(app)
      .patch('/api/shipping-addresses/' + second.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ city: '  Barcelona  ', isDefault: true })
      .expect(200);
    expect(updated.body.city).toBe('Barcelona');
    expect((await second.reload()).isDefault).toBe(true);
    expect((await first.reload()).isDefault).toBe(false);
    await request(app)
      .patch(`/api/shipping-addresses/${first.id}/default`)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect((await first.reload()).isDefault).toBe(true);
    expect((await second.reload()).isDefault).toBe(false);
    expect((await other.reload()).isDefault).toBe(true);
    const list = await request(app)
      .get('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(list.body.map((a: { id: number }) => a.id).sort()).toEqual([first.id, second.id].sort());
  });

  it('replaces a deleted default with the oldest remaining address and allows deleting the last address', async () => {
    const user = await createUser();
    const first = await createShippingAddress(user.id);
    const oldest = await createShippingAddress(user.id, { isDefault: false });
    const latest = await createShippingAddress(user.id, { isDefault: false });
    await oldest.update({ created_at: new Date('2020-01-01') });
    await latest.update({ created_at: new Date('2021-01-01') });
    const token = createToken(user);
    const deleted = await request(app)
      .delete('/api/shipping-addresses/' + first.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(deleted.body.message).toBe('Shipping address deleted');
    expect(await ShippingAddress.findByPk(first.id)).toBeNull();
    expect((await oldest.reload()).isDefault).toBe(true);
    expect((await latest.reload()).isDefault).toBe(false);
    await request(app)
      .delete('/api/shipping-addresses/' + latest.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect((await oldest.reload()).isDefault).toBe(true);
    await request(app)
      .delete('/api/shipping-addresses/' + oldest.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(await ShippingAddress.count()).toBe(0);
  });

  it.each(['get', 'patch', 'delete', 'default'] as const)(
    'rejects %s for another account or a missing address without changes',
    async (operation) => {
      const owner = await createUser();
      const address = await createShippingAddress(owner.id);
      const token = createToken(await createUser());
      for (const id of [address.id, 999999]) {
        const method = operation === 'default' ? 'patch' : operation;
        const response = await request(app)
          [method]('/api/shipping-addresses/' + id + (operation === 'default' ? '/default' : ''))
          .set('Authorization', 'Bearer ' + token)
          .send(operation === 'patch' ? { city: 'Changed' } : undefined)
          .expect(404);
        expect(response.body).toEqual({ error: 'Shipping address not found' });
      }
      expect((await address.reload()).toJSON()).toMatchObject({
        userId: owner.id,
        city: 'Madrid',
        isDefault: true,
      });
      expect(await ShippingAddress.count()).toBe(1);
    },
  );

  it.each([
    ['recipientName', 'A'],
    ['recipientName', 'A'.repeat(151)],
    ['street', 'AB'],
    ['street', 'A'.repeat(256)],
    ['city', 'A'],
    ['city', 'A'.repeat(101)],
    ['postalCode', '12'],
    ['postalCode', 'A'.repeat(21)],
    ['province', 'A'],
    ['province', 'A'.repeat(101)],
    ['country', 'A'],
    ['country', 'A'.repeat(101)],
    ['phone', '123456'],
    ['phone', '1'.repeat(31)],
    ['isDefault', 'true'],
  ])('rejects invalid %s in create and update without writes', async (field, value) => {
    const user = await createUser();
    const address = await createShippingAddress(user.id);
    const token = createToken(user);
    const create = await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ ...shippingAddressSnapshot, [field]: value })
      .expect(400);
    expect(create.body.error).toBe('Validation failed');
    await request(app)
      .patch('/api/shipping-addresses/' + address.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ [field]: value })
      .expect(400);
    expect(await ShippingAddress.count()).toBe(1);
    expect((await address.reload()).toJSON()).toMatchObject(shippingAddressSnapshot);
  });

  it('requires the complete address payload when creating', async () => {
    const token = createToken(await createUser());
    await request(app)
      .post('/api/shipping-addresses')
      .set('Authorization', 'Bearer ' + token)
      .send({ recipientName: 'Buyer' })
      .expect(400);
    expect(await ShippingAddress.count()).toBe(0);
  });

  it.each(['get', 'patch', 'delete', 'default'] as const)(
    'validates IDs for %s',
    async (operation) => {
      const token = createToken(await createUser());
      for (const id of ['abc', '0', '-1', '1.5']) {
        const method = operation === 'default' ? 'patch' : operation;
        await request(app)
          [method]('/api/shipping-addresses/' + id + (operation === 'default' ? '/default' : ''))
          .set('Authorization', 'Bearer ' + token)
          .send(operation === 'patch' ? { city: 'Madrid' } : undefined)
          .expect(400);
      }
    },
  );

  it.each(['list', 'get', 'post', 'patch', 'delete', 'default'] as const)(
    'requires authentication for %s',
    async (operation) => {
      const method = operation === 'list' ? 'get' : operation === 'default' ? 'patch' : operation;
      const path =
        '/api/shipping-addresses' +
        (operation === 'list' || operation === 'post' ? '' : '/1') +
        (operation === 'default' ? '/default' : '');
      await request(app)[method](path).send(shippingAddressSnapshot).expect(401);
      const token = createToken(await createUser({ isBanned: true }));
      await request(app)
        [method](path)
        .set('Authorization', 'Bearer ' + token)
        .send(shippingAddressSnapshot)
        .expect(403);
      expect(await ShippingAddress.count()).toBe(0);
    },
  );
});
