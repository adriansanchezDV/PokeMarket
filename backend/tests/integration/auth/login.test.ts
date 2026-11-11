import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createUser } from '../../helpers/userTestHelpers.js';
import jwt from 'jsonwebtoken';

import app from '../../../src/app.js';
import config from '../../../src/config/env.js';
describe('POST /api/auth/login', () => {
  const password = 'Password123';
  const email = 'login.test@example.com';

  const createLoginUser = (overrides: Parameters<typeof createUser>[0] = {}) =>
    createUser({ fullName: 'Login Test', email, ...overrides });

  it('inicia sesión con credenciales correctas', async () => {
    await createLoginUser();

    const response = await request(app).post('/api/auth/login').send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      fullName: 'Login Test',
      email,
      role: 'customer',
    });
    expect(response.body.user.id).toEqual(expect.any(Number));
  });

  it('devuelve un JWT válido con los datos del usuario', async () => {
    const user = await createLoginUser();

    const response = await request(app).post('/api/auth/login').send({ email, password });

    expect(response.status).toBe(200);

    const decoded = jwt.verify(response.body.token, config.JWT_SECRET);

    expect(decoded).toMatchObject({
      id: user.id,
      email,
      role: 'customer',
    });
  });

  it('no incluye la contraseña ni su hash en la respuesta', async () => {
    await createLoginUser();

    const response = await request(app).post('/api/auth/login').send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rechaza una contraseña incorrecta', async () => {
    await createLoginUser();

    const response = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassword123',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('rechaza un email inexistente', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password,
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('rechaza el login si falta el email', async () => {
    const response = await request(app).post('/api/auth/login').send({ password });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza el login si el email tiene un formato incorrecto', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'email-invalido',
      password,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza el login si falta la contraseña', async () => {
    const response = await request(app).post('/api/auth/login').send({ email });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza una contraseña vacía', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email,
      password: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('permite iniciar sesión con una contraseña de menos de 8 caracteres si coincide con la almacenada', async () => {
    await createLoginUser({ password: 'abc' });

    const response = await request(app).post('/api/auth/login').send({
      email,
      password: 'abc',
    });

    expect(response.status).toBe(200);
  });

  it('rechaza el acceso de un usuario bloqueado', async () => {
    await createLoginUser({ isBanned: true });

    const response = await request(app).post('/api/auth/login').send({ email, password });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('User account is banned');
  });
});
