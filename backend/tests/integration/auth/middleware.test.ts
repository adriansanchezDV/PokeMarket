import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';

import app from '../../../src/app.js';
import config from '../../../src/config/env.js';
describe('Middleware de autenticación', () => {
  describe('GET /api/auth/seller-test', () => {
    it('devuelve 401 cuando no se envía token', async () => {
      const response = await request(app).get('/api/auth/seller-test');

      expect(response.status).toBe(401);
    });

    it('devuelve 401 cuando el token es inválido', async () => {
      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', 'Bearer token-invalido');

      expect(response.status).toBe(401);
    });

    it('devuelve 401 cuando falta el prefijo Bearer', async () => {
      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', 'token-invalido');

      expect(response.status).toBe(401);
    });

    it('devuelve 401 cuando el JWT ha expirado', async () => {
      const user = await createUser({ role: 'seller' });

      const token = createToken(user, { expiresIn: -1 });

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('devuelve 401 cuando el usuario del token no existe', async () => {
      const token = jwt.sign(
        {
          id: 999999999,
          email: 'missing@example.com',
          role: 'seller',
        },
        config.JWT_SECRET,
        { expiresIn: '1h' },
      );

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('permite continuar a un vendedor autenticado', async () => {
      const user = await createUser({ role: 'seller' });

      const token = createToken(user);

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('devuelve 403 cuando el usuario está bloqueado', async () => {
      const user = await createUser({ role: 'seller', isBanned: true });

      const token = createToken(user);

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  it.each([
    { email: 'payload@example.com', role: 'seller' },
    { id: '1', email: 'payload@example.com', role: 'seller' },
    { id: 1, email: 'payload@example.com', role: 'superadmin' },
    { id: 1, role: 'seller' },
  ])('rechaza un JWT firmado con payload inválido: %j', async (payload) => {
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/seller-test')
      .set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid token payload' });
  });

  it('rechaza un JWT firmado con otra clave', async () => {
    const user = await createUser({ role: 'seller' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      'incorrect-test-key',
    );
    const response = await request(app)
      .get('/api/auth/seller-test')
      .set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('rechaza un token emitido antes del baneo de la cuenta', async () => {
    const user = await createUser({ role: 'seller' });
    const token = createToken(user);
    await user.update({ isBanned: true });
    const response = await request(app)
      .get('/api/auth/seller-test')
      .set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'User account is banned' });
    expect((await user.reload()).isBanned).toBe(true);
  });
});
