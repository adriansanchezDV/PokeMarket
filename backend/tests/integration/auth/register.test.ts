import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

import app from '../../../src/app.js';
import { User } from '../../../src/models/indexModel.js';
describe('POST /api/auth/register', () => {
  it('registra un usuario con datos válidos', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Adrian Test',
      email: 'adrian.test@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      fullName: 'Adrian Test',
      email: 'adrian.test@example.com',
      role: 'customer',
    });
    expect(response.body.id).toEqual(expect.any(Number));
  });

  it('rechaza el registro si falta el email', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Adrian Test',
      password: 'Password123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza el registro si falta la contraseña', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Adrian Test',
      email: 'adrian.test@example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza el registro si faltan el email y la contraseña', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Adrian Test',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rechaza un email que ya está registrado', async () => {
    const user = {
      fullName: 'Adrian Test',
      email: 'adrian.test@example.com',
      password: 'Password123',
    };

    const firstResponse = await request(app).post('/api/auth/register').send(user);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app).post('/api/auth/register').send(user);

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error).toBe('Email already registered');
  });

  it('almacena la contraseña mediante un hash', async () => {
    const password = 'Password123';

    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Adrian Test',
        email: 'adrian.test@example.com',
        password,
      })
      .expect(201);

    const user = await User.findOne({
      where: { email: 'adrian.test@example.com' },
    });

    expect(user).not.toBeNull();
    expect(user!.password).not.toBe(password);
    expect(await bcrypt.compare(password, user!.password)).toBe(true);
  });

  it('no devuelve la contraseña ni su hash en la respuesta', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Adrian Test',
      email: 'adrian.test@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('permite registrar un usuario sin nombre completo', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'adrian.test@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(201);
    expect(response.body.fullName).toBeNull();
  });

  it('guarda el usuario correctamente en PostgreSQL', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Adrian Test',
        email: 'adrian.test@example.com',
        password: 'Password123',
      })
      .expect(201);

    const user = await User.findOne({
      where: { email: 'adrian.test@example.com' },
    });

    expect(user).not.toBeNull();
    expect(user!.fullName).toBe('Adrian Test');
    expect(user!.email).toBe('adrian.test@example.com');
    expect(user!.role).toBe('customer');
  });

  it.each([
    { email: 'not-an-email', password: 'Password123' },
    { email: 'invalid@example.com', password: 'short' },
    { email: 'invalid@example.com', password: 'Password123', fullName: 'A' },
  ])('rechaza datos inválidos sin crear usuarios: %j', async (payload) => {
    const response = await request(app).post('/api/auth/register').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(await User.count()).toBe(0);
  });

  it('ignora privilegios enviados al registrar y persiste una cuenta customer activa', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'privileges@example.com',
      password: 'Password123',
      role: 'admin',
      isBanned: true,
    });
    expect(response.status).toBe(201);
    expect(response.body.role).toBe('customer');
    const user = await User.findByPk(response.body.id);
    expect(user).not.toBeNull();
    expect(user?.role).toBe('customer');
    expect(user?.isBanned).toBe(false);
  });
});
