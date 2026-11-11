import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Favorite, Notification, Product } from '../../../src/models/indexModel.js';
import app from '../../../src/app.js';
import { createToken, createUser } from '../../helpers/userTestHelpers.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createCard } from '../../factories/cardFactory.js';
import { createProduct } from '../../factories/productFactory.js';

const productBody = (cardId: number) => ({
  cardId,
  condition: 'Near Mint',
  language: 'English',
  price: 25,
  stock: 3,
  description: 'Test offer',
});
const offer = async (options: Parameters<typeof createProduct>[0] = {}) => {
  const seller = await createSellerWithProfile();
  const product = await createProduct({ ...options, sellerProfileId: seller.profile.id });
  return { ...seller, product };
};

describe('Products seller API', () => {
  describe('POST /api/products', () => {
    it('creates a product for the authenticated seller', async () => {
      const { profile, token } = await createSellerWithProfile();
      const card = await createCard();
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + token)
        .send({ ...productBody(card.id), sellerProfileId: 999999, isActive: false })
        .expect(201);
      expect(response.body).toMatchObject({
        sellerProfileId: profile.id,
        cardId: card.id,
        price: '25.00',
        stock: 3,
        isActive: true,
      });
      const saved = await Product.findByPk(response.body.id);
      expect(saved?.toJSON()).toMatchObject({
        sellerProfileId: profile.id,
        cardId: card.id,
        price: '25.00',
        stock: 3,
        description: 'Test offer',
      });
      expect(await Product.count()).toBe(1);
    });

    it('returns 401 when no token is provided', async () => {
      const response = await request(app).post('/api/products').send(productBody(1)).expect(401);
      expect(response.body).toEqual({ error: 'Token missing' });
      expect(await Product.count()).toBe(0);
    });

    it('returns 403 when the user is not a seller', async () => {
      const user = await createUser();
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + createToken(user))
        .send(productBody(1))
        .expect(403);
      expect(response.body).toEqual({ error: 'Insufficient permissions' });
      expect(await Product.count()).toBe(0);
    });

    it('returns 404 when the seller profile does not exist', async () => {
      const user = await createUser({ role: 'seller' });
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + createToken(user))
        .send(productBody(1))
        .expect(404);
      expect(response.body).toEqual({ error: 'Seller profile not found' });
      expect(await Product.count()).toBe(0);
    });

    it('returns 404 when the referenced card does not exist', async () => {
      const { token } = await createSellerWithProfile();
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + token)
        .send(productBody(999999))
        .expect(404);
      expect(response.body).toEqual({ error: 'Card not found' });
      expect(await Product.count()).toBe(0);
    });

    it('returns 400 when the product data is invalid', async () => {
      const { token } = await createSellerWithProfile();
      await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + token)
        .send({ ...productBody(1), price: -10 })
        .expect(400);
      expect(await Product.count()).toBe(0);
    });

    it.each([
      { stock: -1 },
      { stock: 1.5 },
      { price: 0 },
      { cardId: 0 },
      { condition: '' },
      { language: '' },
    ])('rejects invalid product fields without writes: %j', async (fields) => {
      const { token } = await createSellerWithProfile();
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer ' + token)
        .send({ ...productBody(1), ...fields })
        .expect(400);
      expect(response.body.error).toBe('Validation failed');
      expect(await Product.count()).toBe(0);
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('updates a product belonging to the seller', async () => {
      const { product, token } = await offer();
      const response = await request(app)
        .patch('/api/products/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({ price: 20, stock: 5 })
        .expect(200);
      expect(response.body).toMatchObject({ id: product.id, price: '20.00', stock: 5 });
      expect((await product.reload()).toJSON()).toMatchObject({ price: '20.00', stock: 5 });
    });

    it('returns 401 when no token is provided', async () => {
      const { product } = await offer();
      await request(app)
        .patch('/api/products/' + product.id)
        .send({ price: 20 })
        .expect(401);
      expect((await product.reload()).price).toBe('25.00');
    });

    it('returns 403 when the user is not a seller', async () => {
      const { product } = await offer();
      const user = await createUser();
      await request(app)
        .patch('/api/products/' + product.id)
        .set('Authorization', 'Bearer ' + createToken(user))
        .send({ price: 20 })
        .expect(403);
      expect((await product.reload()).price).toBe('25.00');
    });

    it('returns 400 for an invalid product ID', async () => {
      const { token } = await createSellerWithProfile();
      const response = await request(app)
        .patch('/api/products/abc')
        .set('Authorization', 'Bearer ' + token)
        .send({ price: 20 })
        .expect(400);
      expect(response.body).toEqual({ error: 'Invalid product id' });
    });

    it('returns 404 when the product does not belong to the seller or does not exist', async () => {
      const { product } = await offer();
      const { token } = await createSellerWithProfile();
      for (const id of [product.id, 999999]) {
        const response = await request(app)
          .patch('/api/products/' + id)
          .set('Authorization', 'Bearer ' + token)
          .send({ price: 20 })
          .expect(404);
        expect(response.body).toEqual({ error: 'Product not found' });
      }
      expect((await product.reload()).price).toBe('25.00');
    });

    it('returns 400 when the update body is empty', async () => {
      const { product, token } = await offer();
      await request(app)
        .patch('/api/products/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({})
        .expect(400);
      expect((await product.reload()).price).toBe('25.00');
    });

    it.each([{ price: -1 }, { stock: -1 }, { stock: 0.5 }, { language: '' }])(
      'rejects invalid edits without changing persisted data: %j',
      async (fields) => {
        const { product, token } = await offer();
        await request(app)
          .patch('/api/products/' + product.id)
          .set('Authorization', 'Bearer ' + token)
          .send(fields)
          .expect(400);
        expect((await product.reload()).toJSON()).toMatchObject({
          price: '25.00',
          stock: 3,
          language: 'English',
        });
      },
    );
  });

  describe('PATCH /api/products/:id/status', () => {
    it('deactivates a product', async () => {
      const { product, token } = await offer();
      const response = await request(app)
        .patch(`/api/products/${product.id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive: false })
        .expect(200);
      expect(response.body.isActive).toBe(false);
      expect((await product.reload()).isActive).toBe(false);
    });

    it('reactivates a product for an active seller', async () => {
      const { product, token } = await offer({ isActive: false });
      await request(app)
        .patch(`/api/products/${product.id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive: true })
        .expect(200);
      expect((await product.reload()).isActive).toBe(true);
    });

    it('returns 400 when the product ID is invalid', async () => {
      const { token } = await createSellerWithProfile();
      const response = await request(app)
        .patch('/api/products/abc/status')
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive: false })
        .expect(400);
      expect(response.body).toEqual({ error: 'Invalid product id' });
    });

    it('returns 400 when isActive is not a boolean', async () => {
      const { product, token } = await offer();
      await request(app)
        .patch(`/api/products/${product.id}/status`)
        .set('Authorization', 'Bearer ' + token)
        .send({ isActive: 'false' })
        .expect(400);
      expect((await product.reload()).isActive).toBe(true);
    });

    it('returns 404 when the product does not exist for this seller', async () => {
      const { product } = await offer();
      const { token } = await createSellerWithProfile();
      for (const id of [product.id, 999999]) {
        await request(app)
          .patch(`/api/products/${id}/status`)
          .set('Authorization', 'Bearer ' + token)
          .send({ isActive: false })
          .expect(404);
      }
      expect((await product.reload()).isActive).toBe(true);
    });

    it.each(['anonymous', 'customer', 'admin'] as const)(
      'rejects status changes by %s',
      async (role) => {
        const { product } = await offer();
        const req = request(app).patch(`/api/products/${product.id}/status`);
        if (role !== 'anonymous')
          req.set('Authorization', 'Bearer ' + createToken(await createUser({ role })));
        await req.send({ isActive: false }).expect(role === 'anonymous' ? 401 : 403);
        expect((await product.reload()).isActive).toBe(true);
      },
    );
  });

  describe('GET /api/products/seller', () => {
    it('returns the authenticated seller products', async () => {
      const { product, token, profile } = await offer();
      const inactive = await createProduct({
        sellerProfileId: profile.id,
        cardId: product.cardId,
        isActive: false,
        stock: 0,
      });
      await createProduct();
      const response = await request(app)
        .get('/api/products/seller')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);
      expect(response.body.map((p: { id: number }) => p.id).sort()).toEqual(
        [product.id, inactive.id].sort(),
      );
      expect(response.body[0].card.id).toBe(product.cardId);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app).get('/api/products/seller').expect(401);
    });

    it('returns 403 when the user is not a seller', async () => {
      await request(app)
        .get('/api/products/seller')
        .set('Authorization', 'Bearer ' + createToken(await createUser()))
        .expect(403);
    });

    it('returns 404 when the seller profile does not exist', async () => {
      const user = await createUser({ role: 'seller' });
      const response = await request(app)
        .get('/api/products/seller')
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(404);
      expect(response.body).toEqual({ error: 'Seller profile not found' });
    });
  });

  it.each(['create', 'edit', 'reactivate'] as const)(
    'blocks %s for inactive sellers without writes',
    async (action) => {
      const { profile, token, product } = await offer({ isActive: false });
      await profile.update({ isActive: false });
      const req =
        action === 'create'
          ? request(app).post('/api/products')
          : request(app).patch(
              '/api/products/' + product.id + (action === 'reactivate' ? '/status' : ''),
            );
      const response = await req
        .set('Authorization', 'Bearer ' + token)
        .send(
          action === 'create'
            ? productBody(product.cardId)
            : action === 'edit'
              ? { price: 20 }
              : { isActive: true },
        )
        .expect(403);
      expect(response.body).toEqual({ error: 'Seller profile is inactive' });
      expect(await Product.count()).toBe(1);
      expect((await product.reload()).toJSON()).toMatchObject({ price: '25.00', isActive: false });
    },
  );

  it('allows an inactive seller to consult and deactivate their existing offers', async () => {
    const { profile, product, token } = await offer();
    await profile.update({ isActive: false });
    const response = await request(app)
      .get('/api/products/seller')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body[0].id).toBe(product.id);
    await request(app)
      .patch(`/api/products/${product.id}/status`)
      .set('Authorization', 'Bearer ' + token)
      .send({ isActive: false })
      .expect(200);
    expect((await product.reload()).isActive).toBe(false);
  });

  it('persists restock and price-drop notifications only for other users who favorited the offer', async () => {
    const { product, user, token } = await offer({ stock: 0 });
    const follower = await createUser();
    const unrelated = await createUser();
    await Favorite.bulkCreate([
      { userId: follower.id, productId: product.id },
      { userId: user.id, productId: product.id },
    ]);
    await request(app)
      .patch('/api/products/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ price: 20, stock: 5 })
      .expect(200);
    const notifications = await Notification.findAll({ where: { userId: follower.id } });
    expect(notifications.map((n) => n.type).sort()).toEqual([
      'favorite_price_drop',
      'favorite_restock',
    ]);
    expect(notifications.every((n) => n.productId === product.id)).toBe(true);
    expect(await Notification.count({ where: { userId: user.id } })).toBe(0);
    expect(await Notification.count({ where: { userId: unrelated.id } })).toBe(0);
    expect((await product.reload()).toJSON()).toMatchObject({ stock: 5, price: '20.00' });
  });
});
