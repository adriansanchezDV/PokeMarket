import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Cart, CartItem } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createCart } from '../../factories/cartFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';

describe('Cart', () => {
  it('returns an empty cart without creating one', async () => {
    const user = await createUser();
    const response = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer ' + createToken(user))
      .expect(200);
    expect(response.body).toEqual({ id: null, items: [] });
    expect(await Cart.count()).toBe(0);
  });

  it('adds one unit, then increments the same persisted line without reserving stock', async () => {
    const product = await createProduct();
    const user = await createUser();
    const token = createToken(user);
    const first = await request(app)
      .post('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ quantity: 99 })
      .expect(201);
    expect(first.body.quantity).toBe(1);
    const second = await request(app)
      .post('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(201);
    expect(second.body).toMatchObject({ id: first.body.id, quantity: 2, productId: product.id });
    expect(await Cart.count({ where: { userId: user.id } })).toBe(1);
    expect(await CartItem.count()).toBe(1);
    expect((await CartItem.findByPk(first.body.id))?.quantity).toBe(2);
    expect((await product.reload()).stock).toBe(3);
  });

  it('returns current product prices and quantities without inventing subtotal or total fields', async () => {
    const product = await createProduct({ price: 12.35 });
    const { token, cart } = await createCart({ products: [{ product, quantity: 2 }] });
    await product.update({ price: 13.5 });
    const response = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body.id).toBe(cart.id);
    expect(response.body.items[0]).toMatchObject({
      quantity: 2,
      product: {
        id: product.id,
        price: '13.50',
        availability: 'available',
        card: { id: product.cardId },
        sellerProfile: { id: product.sellerProfileId },
      },
    });
    expect(response.body).not.toHaveProperty('total');
    expect(response.body.items[0]).not.toHaveProperty('subtotal');
  });

  it('updates quantities up to the exact available stock', async () => {
    const product = await createProduct();
    const { token, items } = await createCart({ products: [{ product, quantity: 1 }] });
    await request(app)
      .patch('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ quantity: 3 })
      .expect(200);
    expect((await items[0].reload()).quantity).toBe(3);
    await request(app)
      .patch('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ quantity: 1 })
      .expect(200);
    expect((await items[0].reload()).quantity).toBe(1);
    expect((await product.reload()).stock).toBe(3);
  });

  it.each([0, -1, 1.5, '2', null, undefined])(
    'rejects invalid quantity %s without writes',
    async (quantity) => {
      const product = await createProduct();
      const { token, items } = await createCart({ products: [{ product, quantity: 1 }] });
      const response = await request(app)
        .patch('/api/cart/items/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({ quantity })
        .expect(400);
      expect(response.body.error).toBe('Validation failed');
      expect((await items[0].reload()).quantity).toBe(1);
    },
  );

  it.each(['post', 'patch'] as const)(
    'rejects %s beyond stock without changing the existing line',
    async (method) => {
      const product = await createProduct({ stock: 1 });
      const { token, items } = await createCart({ products: [{ product, quantity: 1 }] });
      const response = await request(app)
        [method]('/api/cart/items/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({ quantity: 2 })
        .expect(409);
      expect(response.body).toEqual({ error: 'Insufficient stock' });
      expect((await items[0].reload()).quantity).toBe(1);
    },
  );

  it.each(['inactive-product', 'inactive-seller', 'out-of-stock', 'missing'] as const)(
    'rejects a new %s offer without creating a cart',
    async (state) => {
      const seller = await createSellerWithProfile({ isActive: state !== 'inactive-seller' });
      const product = await createProduct({
        sellerProfileId: seller.profile.id,
        isActive: state !== 'inactive-product',
        stock: state === 'out-of-stock' ? 0 : 3,
      });
      const user = await createUser();
      const response = await request(app)
        .post('/api/cart/items/' + (state === 'missing' ? 999999 : product.id))
        .set('Authorization', 'Bearer ' + createToken(user))
        .expect(state === 'missing' ? 404 : state === 'inactive-seller' ? 403 : 409);
      expect(response.body.error).toBe(
        {
          'inactive-product': 'Product is inactive',
          'inactive-seller': 'Seller profile is inactive',
          'out-of-stock': 'Product out of stock',
          missing: 'Product not found',
        }[state],
      );
      expect(await Cart.count()).toBe(0);
      expect(await CartItem.count()).toBe(0);
    },
  );

  it.each(['product', 'seller'] as const)(
    'keeps an inactive %s visible, blocks increases and permits reductions and removal',
    async (state) => {
      const { profile } = await createSellerWithProfile();
      const product = await createProduct({ sellerProfileId: profile.id, stock: 5 });
      const { token, items } = await createCart({ products: [{ product, quantity: 2 }] });
      await (state === 'product'
        ? product.update({ isActive: false })
        : profile.update({ isActive: false }));
      const cart = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);
      expect(cart.body.items[0].product.availability).toBe('inactive');
      await request(app)
        .patch('/api/cart/items/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({ quantity: 3 })
        .expect(state === 'product' ? 409 : 403);
      expect((await items[0].reload()).quantity).toBe(2);
      await request(app)
        .patch('/api/cart/items/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .send({ quantity: 1 })
        .expect(200);
      expect((await items[0].reload()).quantity).toBe(1);
      await request(app)
        .delete('/api/cart/items/' + product.id)
        .set('Authorization', 'Bearer ' + token)
        .expect(204);
      expect(await CartItem.count()).toBe(0);
    },
  );

  it('shows out-of-stock items and permits their deletion', async () => {
    const product = await createProduct();
    const { token } = await createCart({ products: [{ product, quantity: 1 }] });
    await product.update({ stock: 0 });
    const response = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body.items[0].product.availability).toBe('out_of_stock');
    await request(app)
      .delete('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(204);
  });

  it('isolates reads, edits, deletions and clearing between users', async () => {
    const product = await createProduct();
    const first = await createCart({ products: [{ product, quantity: 1 }] });
    const second = await createCart();
    const empty = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer ' + second.token)
      .expect(200);
    expect(empty.body.items).toEqual([]);
    await request(app)
      .patch('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + second.token)
      .send({ quantity: 2 })
      .expect(404);
    await request(app)
      .delete('/api/cart/items/' + product.id)
      .set('Authorization', 'Bearer ' + second.token)
      .expect(404);
    await request(app)
      .delete('/api/cart')
      .set('Authorization', 'Bearer ' + second.token)
      .expect(204);
    expect((await first.items[0].reload()).quantity).toBe(1);
    await request(app)
      .delete('/api/cart')
      .set('Authorization', 'Bearer ' + first.token)
      .expect(204);
    expect(await CartItem.count()).toBe(0);
    expect(await Cart.count()).toBe(2);
  });

  it('clears a missing cart idempotently and reports missing carts/items on mutation', async () => {
    const user = await createUser();
    const token = createToken(user);
    await request(app)
      .delete('/api/cart')
      .set('Authorization', 'Bearer ' + token)
      .expect(204);
    for (const method of ['patch', 'delete'] as const) {
      const missing = await request(app)
        [method]('/api/cart/items/999999')
        .set('Authorization', 'Bearer ' + token)
        .send({ quantity: 1 })
        .expect(404);
      expect(missing.body.error).toBe('Cart not found');
    }
    await createCart({ user });
    const missing = await request(app)
      .delete('/api/cart/items/999999')
      .set('Authorization', 'Bearer ' + token)
      .expect(404);
    expect(missing.body.error).toBe('Cart item not found');
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'rejects invalid product IDs for %s',
    async (method) => {
      const token = createToken(await createUser());
      for (const id of ['abc', '0', '-1', '1.5']) {
        const response = await request(app)
          [method]('/api/cart/items/' + id)
          .set('Authorization', 'Bearer ' + token)
          .send({ quantity: 1 })
          .expect(400);
        expect(response.body).toEqual({ error: 'Invalid product id' });
      }
    },
  );

  it.each(['get', 'post', 'patch', 'delete', 'clear'] as const)(
    'requires authentication for %s',
    async (operation) => {
      const path = operation === 'get' || operation === 'clear' ? '/api/cart' : '/api/cart/items/1';
      const method = operation === 'clear' ? 'delete' : operation;
      await request(app)[method](path).send({ quantity: 1 }).expect(401);
      const user = await createUser({ isBanned: true });
      await request(app)
        [method](path)
        .set('Authorization', 'Bearer ' + createToken(user))
        .send({ quantity: 1 })
        .expect(403);
      expect(await Cart.count()).toBe(0);
    },
  );
});
