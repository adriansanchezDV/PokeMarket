import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';
import { User } from '../../../src/models/indexModel.js';
import { createToken, createUser } from '../../helpers/userTestHelpers.js';

describe('API - Seguridad de usuarios', () => {
  describe('Campos protegidos', () => {
    it('no permite elevar el rol a admin', async () => {
      const user = await createUser({ role: 'customer' });

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ role: 'admin' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('At least one field is required');

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.role).toBe('customer');
      expect(response.body.role).not.toBe('admin');
    });

    it('no permite cambiar el rol a seller desde el perfil', async () => {
      const user = await createUser({ role: 'customer' });

      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ role: 'seller' })
        .expect(400);

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.role).toBe('customer');
    });

    it('no permite desbanear la cuenta desde el perfil', async () => {
      const user = await createUser({
        isBanned: true,
      });

      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ isBanned: false })
        .expect(403);

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.isBanned).toBe(true);
    });

    it('no permite cambiar el identificador del usuario', async () => {
      const user = await createUser();
      const anotherUser = await createUser();

      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ id: anotherUser.id })
        .expect(400);

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.id).toBe(user.id);
    });

    it('no permite modificar el email mediante un campo alternativo', async () => {
      const user = await createUser();
      const originalEmail = user.email;

      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ userId: 999999 })
        .expect(400);

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.email).toBe(originalEmail);
      expect(updatedUser?.id).toBe(user.id);
    });
  });

  describe('Autenticación', () => {
    it('rechaza una petición con un token malformado', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer esto.no.es.un.jwt')
        .send({ fullName: 'Intento' });

      expect(response.status).toBe(401);
    });

    it('no permite consultar el perfil sin autenticación', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
    });

    it('no permite actualizar el perfil sin autenticación', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .send({ email: 'intruso@example.com' });

      expect(response.status).toBe(401);
    });
  });

  it.each(['get', 'patch'] as const)(
    'rechaza %s del perfil de una cuenta baneada sin modificar sus datos',
    async (method) => {
      const user = await createUser({ isBanned: true, fullName: 'Banned User' });
      const response = await request(app)
        [method]('/api/users/me')
        .set('Authorization', 'Bearer ' + createToken(user))
        .send(method === 'patch' ? { fullName: 'Changed' } : undefined);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'User account is banned' });
      await user.reload();
      expect(user.fullName).toBe('Banned User');
      expect(user.isBanned).toBe(true);
    },
  );

  it('actualiza únicamente al usuario autenticado aunque el payload señale otra cuenta', async () => {
    const user = await createUser({ fullName: 'Owner' });
    const other = await createUser({ fullName: 'Other User' });
    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer ' + createToken(user))
      .send({ id: other.id, userId: other.id, fullName: 'Updated Owner', role: 'admin' });
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(user.id);
    await user.reload();
    await other.reload();
    expect(user.fullName).toBe('Updated Owner');
    expect(user.role).toBe('customer');
    expect(other.fullName).toBe('Other User');
    expect(other.role).toBe('customer');
  });
});
