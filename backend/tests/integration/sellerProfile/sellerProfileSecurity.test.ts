import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../../src/app.js';
import { SellerProfile, User } from '../../../src/models/indexModel.js';
import config from '../../../src/config/env.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
describe('Seller profile security', () => {
  describe('Authentication', () => {
    it('returns 401 when creating a profile without a token', async () => {
      const response = await request(app)
        .post('/api/sellers/profile')
        .send({ storeName: 'My Store' });

      expect(response.status).toBe(401);
    });

    it('returns 401 when updating a profile without a token', async () => {
      const response = await request(app)
        .patch('/api/sellers/profile')
        .send({ storeName: 'Updated Store' });

      expect(response.status).toBe(401);
    });

    it('returns 401 when using a malformed token to create a profile', async () => {
      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send({ storeName: 'My Store' });

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    it('returns 403 when a customer tries to update a seller profile', async () => {
      const customer = await createUser({ role: 'customer' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(customer)}`)
        .send({ storeName: 'Updated Store' });

      expect(response.status).toBe(403);
    });

    it('does not let a seller update another seller profile by sending another userId', async () => {
      const { user: firstSeller, profile: firstProfile } = await createSellerWithProfile({
        storeName: 'First Store',
        description: 'First description',
      });
      const { user: secondSeller, profile: secondProfile } = await createSellerWithProfile({
        storeName: 'Second Store',
        description: 'Second description',
      });
      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(firstSeller)}`)
        .send({
          userId: secondSeller.id,
          storeName: 'Hijacked Store',
        });

      expect(response.status).toBe(200);

      const firstProfileAfter = await SellerProfile.findByPk(firstProfile.id);
      const secondProfileAfter = await SellerProfile.findByPk(secondProfile.id);

      expect(secondProfileAfter?.storeName).toBe('Second Store');

      expect(firstProfileAfter?.storeName).toBe('Hijacked Store');
      expect(firstProfileAfter?.userId).toBe(firstSeller.id);
      expect(secondProfileAfter?.userId).toBe(secondSeller.id);
    });

    it('does not allow changing userId through the update endpoint', async () => {
      const { user: seller, profile } = await createSellerWithProfile({
        storeName: 'My Store',
        description: null,
      });
      const otherUser = await createUser();

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(seller)}`)
        .send({ userId: otherUser.id });

      expect(response.status).toBe(200);

      const updatedProfile = await SellerProfile.findByPk(profile.id);
      expect(updatedProfile?.userId).toBe(seller.id);
    });

    it('does not allow changing isActive through the update endpoint', async () => {
      const { user: seller, profile } = await createSellerWithProfile({
        storeName: 'Active Store',
        description: null,
        isActive: true,
      });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(seller)}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);

      const updatedProfile = await SellerProfile.findByPk(profile.id);
      expect(updatedProfile?.isActive).toBe(true);
    });
  });

  describe('Protected data', () => {
    it('does not expose private user data in the public seller profile', async () => {
      const { user, profile } = await createSellerWithProfile({
        user: { fullName: 'Public Seller' },
        storeName: 'Public Store',
        description: 'Public description',
      });
      const response = await request(app).get(`/api/sellers/${profile.id}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: user.id,
        fullName: 'Public Seller',
      });

      expect(response.body.user.email).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.role).toBeUndefined();
    });

    it('returns a token with the seller role after creating a profile', async () => {
      const user = await createUser();
      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ storeName: 'New Seller Store' });

      expect(response.status).toBe(201);

      const decoded = jwt.verify(response.body.token, config.JWT_SECRET) as {
        id: number;
        email: string;
        role: string;
      };

      expect(decoded).toMatchObject({
        id: user.id,
        email: user.email,
        role: 'seller',
      });
    });

    it('does not allow a customer to create a profile and remain a customer', async () => {
      const user = await createUser();
      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ storeName: 'Customer Store' });

      expect(response.status).toBe(201);

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser?.role).toBe('seller');
      expect(response.body.user.role).toBe('seller');
    });
  });

  it.each([
    { storeName: 'Changed Store' },
    { description: 'Changed description' },
    { isActive: true, storeName: 'Reactivated Store' },
  ])('impide editar o reactivar un perfil desactivado: %j', async (payload) => {
    const { user, profile, token } = await createSellerWithProfile({ isActive: false });
    const original = { storeName: profile.storeName, description: profile.description };
    const response = await request(app)
      .patch('/api/sellers/profile')
      .set('Authorization', 'Bearer ' + token)
      .send(payload);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Seller profile is inactive' });
    await profile.reload();
    expect(profile.isActive).toBe(false);
    expect(profile.storeName).toBe(original.storeName);
    expect(profile.description).toBe(original.description);
    expect((await user.reload()).isBanned).toBe(false);
    // Desactivar el perfil comercial no invalida la cuenta ni su rol.
    await request(app)
      .get('/api/auth/seller-test')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
  });

  it('impide recrear un perfil desactivado para eludir la restricción', async () => {
    const { user, profile, token } = await createSellerWithProfile({ isActive: false });
    const response = await request(app)
      .post('/api/sellers/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({ storeName: 'Replacement Store' });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Seller profile already exists' });
    expect(await SellerProfile.count({ where: { userId: user.id } })).toBe(1);
    expect((await profile.reload()).isActive).toBe(false);
  });

  it.each(['post', 'patch'] as const)(
    'rechaza %s de una cuenta baneada aunque el perfil esté activo',
    async (method) => {
      const { profile, token } = await createSellerWithProfile({ user: { isBanned: true } });
      const originalName = profile.storeName;
      const response = await request(app)
        [method]('/api/sellers/profile')
        .set('Authorization', 'Bearer ' + token)
        .send({ storeName: 'Changed Store' });
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'User account is banned' });
      await profile.reload();
      expect(profile.isActive).toBe(true);
      expect(profile.storeName).toBe(originalName);
      expect(await SellerProfile.count()).toBe(1);
    },
  );
});
