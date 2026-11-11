import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { User } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { concurrentCreates } from '../../helpers/concurrentCreates.js';

const register = (email: string) =>
  request(app).post('/api/auth/register').send({ email, password: 'Password123' });
const login = (email: string, password = 'Password123') =>
  request(app).post('/api/auth/login').send({ email, password });

describe('Canonical emails without rewriting historical accounts', () => {
  it('trims and lowercases registration and login before validation', async () => {
    const created = await register('  Mixed.Case@Example.COM  ').expect(201);
    expect(created.body.email).toBe('mixed.case@example.com');
    const user = await User.findByPk(created.body.id);
    expect(user!.email).toBe('mixed.case@example.com');
    const authenticated = await login('  MIXED.case@EXAMPLE.com ').expect(200);
    expect(authenticated.body.user.id).toBe(user!.id);
  });

  it.each(['Historical@Example.COM', ' Historical@Example.COM '])(
    'authenticates historical email %s without changing it or its hash',
    async (email) => {
      const user = await createUser({ email });
      const originalHash = user.password;
      const authenticated = await login('historical@example.com').expect(200);
      expect(authenticated.body.user.id).toBe(user.id);
      await login(' HISTORICAL@example.com ').expect(200);
      expect((await user.reload()).email).toBe(email);
      expect(user.password).toBe(originalHash);
      expect(await User.count()).toBe(1);
    },
  );

  it('blocks registration of a normalized historical duplicate without replacing the account', async () => {
    const user = await createUser({ email: ' Legacy@Example.COM ' });
    const duplicate = await register('legacy@example.com').expect(409);
    expect(duplicate.body).toEqual({ error: 'Email already registered' });
    expect(await User.count()).toBe(1);
    expect((await user.reload()).email).toBe(' Legacy@Example.COM ');
  });

  it('rejects every ambiguous login with the same generic 401, even when one password matches', async () => {
    const first = await createUser({ email: 'Duplicate@Example.com' });
    const second = await createUser({
      email: 'duplicate@example.com',
      password: 'OtherPassword123',
    });
    for (const email of [
      'Duplicate@Example.com',
      'duplicate@example.com',
      ' DUPLICATE@example.com ',
    ]) {
      const response = await login(email).expect(401);
      expect(response.body).toEqual({ error: 'Invalid email or password' });
      expect(response.body).not.toHaveProperty('token');
    }
    expect((await login('duplicate@example.com', 'OtherPassword123').expect(401)).body).toEqual({
      error: 'Invalid email or password',
    });
    expect((await first.reload()).email).toBe('Duplicate@Example.com');
    expect((await second.reload()).email).toBe('duplicate@example.com');
    expect(await User.count()).toBe(2);
  });

  it('preserves wrong-password and banned-account rejection for historical emails', async () => {
    const user = await createUser({ email: 'Banned@Example.com', isBanned: true });
    await login(' BANNED@example.COM ', 'wrong').expect(401);
    expect((await login(' banned@example.com ').expect(403)).body).toEqual({
      error: 'User account is banned',
    });
    expect((await user.reload()).isBanned).toBe(true);
  });

  it('normalizes profile edits and permits preserving the unique own email', async () => {
    const user = await createUser({ email: ' Own@Example.COM ' });
    const token = createToken(user);
    const own = await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer ' + token)
      .send({ email: ' OWN@example.com ' })
      .expect(200);
    expect(own.body.email).toBe('own@example.com');
    const edit = await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer ' + token)
      .send({ fullName: 'Updated Name', email: ' New@Example.COM ' })
      .expect(200);
    expect(edit.body).toMatchObject({ fullName: 'Updated Name', email: 'new@example.com' });
    expect((await user.reload()).email).toBe('new@example.com');
    await login('NEW@example.com').expect(200);
  });

  it('rejects collisions on edits, including a historical own email shared with another account', async () => {
    const first = await createUser({ email: 'First@Example.com', fullName: 'Original Name' });
    const second = await createUser({ email: ' SECOND@example.com ' });
    const token = createToken(first);
    await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer ' + token)
      .send({ fullName: 'Must Not Persist', email: 'second@example.com' })
      .expect(409);
    expect((await first.reload()).toJSON()).toMatchObject({
      fullName: 'Original Name',
      email: 'First@Example.com',
    });
    await createUser({ email: 'first@example.com' });
    await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer ' + token)
      .send({ email: 'First@Example.com' })
      .expect(409);
    expect((await first.reload()).email).toBe('First@Example.com');
    expect((await second.reload()).email).toBe(' SECOND@example.com ');
  });

  it.each(['with space@example.com', 'no-at-sign', 'x'.repeat(243) + '@example.com'])(
    'rejects invalid or oversized normalized emails %s without writes',
    async (email) => {
      const user = await createUser();
      await register(email).expect(400);
      await login(email).expect(400);
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer ' + createToken(user))
        .send({ email })
        .expect(400);
      expect(await User.count()).toBe(1);
      expect((await user.reload()).email).toBe('user-1@example.com');
    },
  );

  it('keeps one canonical account when two registrations pass their duplicate checks together', async () => {
    const responses = await concurrentCreates(User, [
      register('Race@Example.com'),
      register('race@example.com'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const users = await User.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('race@example.com');
  }, 15_000);

  it('allows only one of two accounts to claim the same normalized email concurrently', async () => {
    const users = [await createUser(), await createUser()];
    const responses = await Promise.all(
      users.map((user, index) =>
        request(app)
          .patch('/api/users/me')
          .set('Authorization', 'Bearer ' + createToken(user))
          .send({ email: index ? 'CLAIM@example.com' : 'claim@example.com' })
          .timeout({ response: 8_000, deadline: 9_000 }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await User.count({ where: { email: 'claim@example.com' } })).toBe(1);
    const winner = responses.findIndex((response) => response.status === 200);
    expect((await users[winner].reload()).email).toBe('claim@example.com');
    expect((await users[1 - winner].reload()).email).toBe(`user-${2 - winner}@example.com`);
  });
});
