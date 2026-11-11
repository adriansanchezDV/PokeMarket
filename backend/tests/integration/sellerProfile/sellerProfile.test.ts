import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';
import { SellerProfile, User } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
describe('Seller profiles', () => {
  describe('POST /api/sellers/profile', () => {
    it('creates a seller profile and changes the user role to seller', async () => {
      const user = await createUser();
      const token = createToken(user);

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          storeName: 'Adrian TCG Store',
          description: 'Especialistas en cartas Pokémon TCG',
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toMatchObject({
        id: user.id,
        role: 'seller',
      });
      expect(response.body.store).toMatchObject({
        userId: user.id,
        storeName: 'Adrian TCG Store',
        description: 'Especialistas en cartas Pokémon TCG',
        isActive: true,
      });
      expect(response.body.token).toBeDefined();

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser?.role).toBe('seller');

      const profile = await SellerProfile.findOne({
        where: { userId: user.id },
      });
      expect(profile).not.toBeNull();
    });

    it('creates a profile without a description', async () => {
      const user = await createUser();
      const token = createToken(user);

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'Pokemon Cards' });

      expect(response.status).toBe(201);
      expect(response.body.store.description).toBeNull();
    });

    it('returns 409 when the user already has a profile', async () => {
      const user = await createUser();
      const token = createToken(user);

      const firstResponse = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'First Store' });

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'Second Store' });

      expect(secondResponse.status).toBe(409);
      expect(await SellerProfile.count()).toBe(1);
    });

    it('returns 409 when the store name is already registered', async () => {
      const firstUser = await createUser();
      const secondUser = await createUser();

      const firstResponse = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(firstUser)}`)
        .send({ storeName: 'Unique Store' });

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(secondUser)}`)
        .send({ storeName: 'Unique Store' });

      expect(secondResponse.status).toBe(409);

      const unchangedUser = await User.findByPk(secondUser.id);
      expect(unchangedUser?.role).toBe('customer');
      expect(await SellerProfile.findOne({ where: { userId: secondUser.id } })).toBeNull();
    });

    it('returns 400 when storeName is missing', async () => {
      const user = await createUser();

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ description: 'Store without a name' });

      expect(response.status).toBe(400);
    });

    it('returns 400 when storeName is too short', async () => {
      const user = await createUser();

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ storeName: 'A' });

      expect(response.status).toBe(400);
    });

    it('returns 400 when storeName exceeds 100 characters', async () => {
      const user = await createUser();

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({ storeName: 'A'.repeat(101) });

      expect(response.status).toBe(400);
    });

    it('returns 400 when description exceeds 2000 characters', async () => {
      const user = await createUser();

      const response = await request(app)
        .post('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(user)}`)
        .send({
          storeName: 'Pokemon Cards',
          description: 'A'.repeat(2001),
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sellers/:id', () => {
    it('returns a public seller profile', async () => {
      const { user, profile } = await createSellerWithProfile({
        user: { fullName: 'Seller Example' },
        storeName: 'Public Store',
        description: 'Public store description',
      });
      const response = await request(app).get(`/api/sellers/${profile.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: profile.id,
        storeName: 'Public Store',
        description: 'Public store description',
        isActive: true,
        user: {
          id: user.id,
          fullName: 'Seller Example',
        },
      });

      expect(response.body.user.email).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('returns 400 for a non-numeric profile ID', async () => {
      const response = await request(app).get('/api/sellers/abc');

      expect(response.status).toBe(400);
    });

    it('returns 400 for a non-positive profile ID', async () => {
      const response = await request(app).get('/api/sellers/0');

      expect(response.status).toBe(400);
    });

    it('returns 404 when the profile does not exist', async () => {
      const response = await request(app).get('/api/sellers/999999');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/sellers/profile', () => {
    it('updates the store name and description', async () => {
      const { profile, token } = await createSellerWithProfile({ storeName: 'Original Store' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          storeName: 'Updated Store',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: profile.id,
        storeName: 'Updated Store',
        description: 'Updated description',
      });

      const updatedProfile = await SellerProfile.findByPk(profile.id);
      expect(updatedProfile?.storeName).toBe('Updated Store');
      expect(updatedProfile?.description).toBe('Updated description');
    });

    it('updates only the description', async () => {
      const { token } = await createSellerWithProfile({ storeName: 'Original Store' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'New description' });

      expect(response.status).toBe(200);
      expect(response.body.storeName).toBe('Original Store');
      expect(response.body.description).toBe('New description');
    });

    it('allows setting description to null', async () => {
      const { token } = await createSellerWithProfile({ storeName: 'Original Store' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: null });

      expect(response.status).toBe(200);
      expect(response.body.description).toBeNull();
    });

    it('returns 409 when the new store name is already registered', async () => {
      const { profile, token } = await createSellerWithProfile({ storeName: 'Original Store' });

      await createSellerWithProfile({ storeName: 'Already Taken', description: null });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'Already Taken' });

      expect(response.status).toBe(409);
      await profile.reload();
      expect(profile.storeName).toBe('Original Store');
      expect(profile.description).toBe('Original description');
    });

    it('returns 400 when storeName is too short', async () => {
      const { token } = await createSellerWithProfile({ storeName: 'Original Store' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'A' });

      expect(response.status).toBe(400);
    });

    it('returns 400 when description exceeds 2000 characters', async () => {
      const { token } = await createSellerWithProfile({ storeName: 'Original Store' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'A'.repeat(2001) });

      expect(response.status).toBe(400);
    });

    it('returns 404 when the seller has no profile', async () => {
      const seller = await createUser({ role: 'seller' });

      const response = await request(app)
        .patch('/api/sellers/profile')
        .set('Authorization', `Bearer ${createToken(seller)}`)
        .send({ storeName: 'Updated Store' });

      expect(response.status).toBe(404);
    });
  });
});
