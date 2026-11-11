import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';
import { User } from '../../../src/models/indexModel.js';
import { createToken, createUser } from '../../helpers/userTestHelpers.js';

describe('API - Perfil de usuario', () => {
  describe('GET /api/users/me', () => {
    it('devuelve el perfil del usuario autenticado', async () => {
      const user = await createUser({
        fullName: 'Adrian Test',
        email: 'adrian@example.com',
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.fullName).toBe('Adrian Test');
      expect(response.body.email).toBe('adrian@example.com');
      expect(response.body.role).toBe('customer');
    });

    it('no expone la contraseña ni su hash', async () => {
      const user = await createUser();

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rechaza una petición sin token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
    });

    it('rechaza un token inválido', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer token-invalido');

      expect(response.status).toBe(401);
    });

    it('devuelve los datos actuales de la base de datos', async () => {
      const user = await createUser({
        fullName: 'Nombre Original',
      });

      user.fullName = 'Nombre Modificado';
      await user.save();

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`);

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe('Nombre Modificado');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('actualiza el nombre y lo persiste', async () => {
      const user = await createUser();
      const token = createToken(user);

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Nuevo Nombre' });

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe('Nuevo Nombre');

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.fullName).toBe('Nuevo Nombre');
    });

    it('actualiza el email y lo persiste', async () => {
      const user = await createUser();
      const token = createToken(user);

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'nuevo@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('nuevo@example.com');

      const updatedUser = await User.findByPk(user.id);

      expect(updatedUser?.email).toBe('nuevo@example.com');
    });

    it('actualiza nombre y email en la misma petición', async () => {
      const user = await createUser();
      const token = createToken(user);

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Nombre Completo',
          email: 'completo@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe('Nombre Completo');
      expect(response.body.email).toBe('completo@example.com');
      await user.reload();
      expect(user.fullName).toBe('Nombre Completo');
      expect(user.email).toBe('completo@example.com');
    });

    it('permite conservar el email actual', async () => {
      const user = await createUser({
        email: 'actual@example.com',
      });

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({
          fullName: 'Nombre Actualizado',
          email: 'actual@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('actual@example.com');
      expect(response.body.fullName).toBe('Nombre Actualizado');
    });

    it('rechaza un email que pertenece a otro usuario', async () => {
      await createUser({ email: 'ocupado@example.com' });

      const user = await createUser();
      const originalEmail = user.email;

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ email: 'ocupado@example.com' });

      expect(response.status).toBe(409);

      const unchangedUser = await User.findByPk(user.id);

      expect(unchangedUser?.email).toBe(originalEmail);
    });

    it('rechaza un email con formato inválido', async () => {
      const user = await createUser();
      const originalEmail = user.email;

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ email: 'email-invalido' });

      expect(response.status).toBe(400);

      const unchangedUser = await User.findByPk(user.id);

      expect(unchangedUser?.email).toBe(originalEmail);
    });

    it('rechaza una petición sin autenticación', async () => {
      const response = await request(app).patch('/api/users/me').send({ fullName: 'Nuevo Nombre' });

      expect(response.status).toBe(401);
    });

    it('rechaza un nombre vacío', async () => {
      const user = await createUser();
      const originalName = user.fullName;

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ fullName: '' });

      expect(response.status).toBe(400);

      const unchangedUser = await User.findByPk(user.id);

      expect(unchangedUser?.fullName).toBe(originalName);
    });

    it('rechaza una petición sin campos actualizables', async () => {
      const user = await createUser();
      const originalName = user.fullName;
      const originalEmail = user.email;

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({});

      // Contrato esperado: un PATCH vacío se rechaza.
      expect(response.status).toBe(400);

      const unchangedUser = await User.findByPk(user.id);

      expect(unchangedUser?.fullName).toBe(originalName);
      expect(unchangedUser?.email).toBe(originalEmail);
    });
  });
});
