import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Favorite } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

describe('Favorites', () => {
  it('returns an empty own list without creating records', async () => {
    const token = createToken(await createUser());
    const response = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toEqual([]);
    expect(await Favorite.count()).toBe(0);
  });

  it('adds only for the authenticated user and returns associated public product data', async () => {
    const user = await createUser();
    const product = await createProduct();
    const token = createToken(user);
    const created = await request(app)
      .post('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ userId: 999999, productId: 999999 })
      .expect(201);
    expect(created.body).toMatchObject({ userId: user.id, productId: product.id });
    expect((await Favorite.findByPk(created.body.id))?.toJSON()).toMatchObject({
      userId: user.id,
      productId: product.id,
    });
    const list = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id: created.body.id,
      productId: product.id,
      product: {
        id: product.id,
        price: '25.00',
        stock: 3,
        availability: 'available',
        card: { id: product.cardId, name: 'Charizard' },
        sellerProfile: { id: product.sellerProfileId },
      },
    });
    expect(list.body[0].product.sellerProfile).not.toHaveProperty('user');
    expect((await product.reload()).stock).toBe(3);
  });

  it('orders own favorites by creation time and never returns another user favorites', async () => {
    const user = await createUser();
    const first = await createProduct();
    const second = await createProduct();
    const old = await Favorite.create({ userId: user.id, productId: first.id });
    await old.update({ created_at: new Date('2020-01-01') });
    const recent = await Favorite.create({ userId: user.id, productId: second.id });
    await Favorite.create({ userId: (await createUser()).id, productId: first.id });
    const response = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(response.body.map((f: { id: number }) => f.id)).toEqual([recent.id, old.id]);
  });

  it('rejects sequential duplicates with a controlled conflict and one persisted favorite', async () => {
    const user = await createUser();
    const product = await createProduct();
    const token = createToken(user);
    await request(app)
      .post('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    const duplicate = await request(app)
      .post('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(409);
    expect(duplicate.body).toEqual({ error: 'Product already in favorites' });
    expect(await Favorite.count({ where: { userId: user.id, productId: product.id } })).toBe(1);
  });

  it.each([
    'available',
    'inactive-product',
    'inactive-seller',
    'out-of-stock',
    'inactive-and-empty',
  ] as const)('allows favoriting %s and reports current availability', async (state) => {
    const user = await createUser();
    const seller = await createSellerWithProfile({ isActive: state !== 'inactive-seller' });
    const product = await createProduct({
      sellerProfileId: seller.profile.id,
      isActive: !['inactive-product', 'inactive-and-empty'].includes(state),
      stock: ['out-of-stock', 'inactive-and-empty'].includes(state) ? 0 : 3,
    });
    const token = createToken(user);
    await request(app)
      .post('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    const response = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body[0].product.availability).toBe(
      state === 'available' ? 'available' : state === 'out-of-stock' ? 'out_of_stock' : 'inactive',
    );
    expect(await Favorite.count()).toBe(1);
  });

  it('deletes only the current user favorite, preserving other users rows', async () => {
    const user = await createUser();
    const other = await createUser();
    const product = await createProduct();
    const owned = await Favorite.create({ userId: user.id, productId: product.id });
    const foreign = await Favorite.create({ userId: other.id, productId: product.id });
    await request(app)
      .delete('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(204);
    expect(await Favorite.findByPk(owned.id)).toBeNull();
    expect(await Favorite.findByPk(foreign.id)).not.toBeNull();
    const duplicate = await request(app)
      .delete('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(404);
    expect(duplicate.body).toEqual({ error: 'Favorite not found' });
  });

  it('cannot delete another account favorite by manipulating the request body', async () => {
    const owner = await createUser();
    const product = await createProduct();
    const favorite = await Favorite.create({ userId: owner.id, productId: product.id });
    await request(app)
      .delete('/api/favorites/' + product.id)
      .set('Authorization', 'Bearer ' + createToken(await createUser()))
      .send({ userId: owner.id, id: favorite.id })
      .expect(404);
    expect(await Favorite.findByPk(favorite.id)).not.toBeNull();
  });

  it('rejects nonexistent products and favorites and cascades favorites when a product is deleted', async () => {
    const user = await createUser();
    const token = createToken(user);
    const missing = await request(app)
      .post('/api/favorites/999999')
      .set('Authorization', 'Bearer ' + token)
      .expect(404);
    expect(missing.body).toEqual({ error: 'Product not found' });
    const product = await createProduct();
    await Favorite.create({ userId: user.id, productId: product.id });
    await product.destroy();
    expect(await Favorite.count()).toBe(0);
    const response = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it.each(['post', 'delete'] as const)(
    'rejects invalid IDs for %s without changes',
    async (method) => {
      const token = createToken(await createUser());
      for (const id of ['abc', '0', '-1', '1.5']) {
        const response = await request(app)
          [method]('/api/favorites/' + id)
          .set('Authorization', 'Bearer ' + token)
          .expect(400);
        expect(response.body).toEqual({ error: 'Invalid productId' });
      }
      expect(await Favorite.count()).toBe(0);
    },
  );

  it.each(['get', 'post', 'delete'] as const)('requires authentication for %s', async (method) => {
    await request(app)
      [method]('/api/favorites' + (method === 'get' ? '' : '/1'))
      .expect(401);
    expect(await Favorite.count()).toBe(0);
  });
});
