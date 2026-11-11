import { describe, expect, it } from 'vitest';
import request from 'supertest';
import sequelize from '../../helpers/testDatabase.js';
import app from '../../../src/app.js';
import { Favorite, Product, User } from '../../../src/models/indexModel.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createOrder } from '../../factories/orderFactory.js';
import { createPurchase } from '../../helpers/purchase.js';

const admin = async () => {
  const user = await createUser({ role: 'admin' });
  return { user, token: createToken(user) };
};

describe('Administration', () => {
  it('confirms admin access and produces a consistent empty dashboard', async () => {
    const { token } = await admin();
    const access = await request(app)
      .get('/api/admin/access')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(access.body).toEqual({ message: 'Admin access granted' });
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toMatchObject({
      users: { total: 1, admins: 1, sellers: 0, customers: 0 },
      sellerProfiles: { total: 0, active: 0, inactive: 0 },
      products: { total: 0, active: 0, inactive: 0, outOfStock: 0 },
      orders: { total: 0, pending: 0, paid: 0, completed: 0, cancelled: 0 },
      revenue: { paid: '0.00', completed: '0.00', confirmedTotal: '0.00', currency: 'EUR' },
    });
    expect(new Date(response.body.generatedAt).toISOString()).toBe(response.body.generatedAt);
  });

  it('counts roles, profile/product flags and order revenue using their actual independent definitions', async () => {
    const { token } = await admin();
    const customer = await createUser();
    await createUser({ isBanned: true });
    const active = await createSellerWithProfile();
    const inactive = await createSellerWithProfile({ isActive: false });
    await createProduct({ sellerProfileId: active.profile.id });
    await createProduct({ sellerProfileId: active.profile.id, stock: 0 });
    await createProduct({ sellerProfileId: active.profile.id, stock: 0, isActive: false });
    await createProduct({ sellerProfileId: inactive.profile.id });
    await createOrder(customer.id, { status: 'pending', total: '10.20' });
    await createOrder(customer.id, { status: 'paid', total: '0.10' });
    await createOrder(customer.id, { status: 'completed', total: '0.20' });
    await createOrder(customer.id, { status: 'cancelled', total: '99.99' });
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toMatchObject({
      users: { total: 5, customers: 2, sellers: 2, admins: 1 },
      sellerProfiles: { total: 2, active: 1, inactive: 1 },
      products: { total: 4, active: 3, inactive: 1, outOfStock: 1 },
      orders: { total: 4, pending: 1, paid: 1, completed: 1, cancelled: 1 },
      revenue: { paid: '0.10', completed: '0.20', confirmedTotal: '0.30', currency: 'EUR' },
    });
    expect(response.body.productsRequiringAttention.outOfStock).toMatchObject({ total: 1 });
    expect(response.body.productsRequiringAttention.outOfStock.items).toHaveLength(1);
    expect(response.body.productsRequiringAttention.inactive.items).toHaveLength(1);
    expect(
      response.body.recentActivity.users.every(
        (user: Record<string, unknown>) => !('password' in user),
      ),
    ).toBe(true);
  });

  it('limits recent records to five and attention lists to ten without truncating totals', async () => {
    const { user, token } = await admin();
    const seller = await createSellerWithProfile();
    const original = await createProduct({ sellerProfileId: seller.profile.id, stock: 0 });
    await Product.bulkCreate(
      Array.from({ length: 11 }, () => ({
        sellerProfileId: seller.profile.id,
        cardId: original.cardId,
        price: 25,
        stock: 0,
        condition: 'Near Mint',
        language: 'English',
        isActive: true,
      })),
    );
    await Product.bulkCreate(
      Array.from({ length: 12 }, () => ({
        sellerProfileId: seller.profile.id,
        cardId: original.cardId,
        price: 25,
        stock: 0,
        condition: 'Near Mint',
        language: 'English',
        isActive: false,
      })),
    );
    const orders = [];
    for (let index = 0; index < 6; index++) {
      const order = await createOrder(user.id);
      await order.update({ created_at: new Date(`202${index}-01-01`) });
      orders.push(order);
    }
    for (let index = 0; index < 5; index++) await createUser();
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body.recentActivity.users).toHaveLength(5);
    expect(response.body.recentActivity.products).toHaveLength(5);
    expect(response.body.recentActivity.orders.map((order: { id: number }) => order.id)).toEqual(
      orders
        .slice(1)
        .reverse()
        .map((order) => order.id),
    );
    expect(response.body.productsRequiringAttention.outOfStock).toMatchObject({ total: 12 });
    expect(response.body.productsRequiringAttention.inactive).toMatchObject({ total: 12 });
    expect(response.body.productsRequiringAttention.outOfStock.items).toHaveLength(10);
    expect(response.body.productsRequiringAttention.inactive.items).toHaveLength(10);
  });

  it('lists, searches and paginates users, including sellers through role filtering', async () => {
    const { token } = await admin();
    const seller = await createSellerWithProfile({
      user: { fullName: 'Alice Seller', email: 'alice-store@example.com' },
    });
    const customer = await createUser({
      fullName: 'Alice Customer',
      email: 'alice-buyer@example.com',
    });
    // created_at is a read-only Sequelize timestamp on instances; prepare the fixture explicitly.
    await sequelize.query('UPDATE public.users SET created_at = :date WHERE id = :id', {
      replacements: { date: '2020-01-01', id: customer.id },
    });
    const filtered = await request(app)
      .get('/api/admin/users')
      .query({ role: 'seller', search: '  ALICE  ', page: 1, limit: 1 })
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(filtered.body.users.map((u: { id: number }) => u.id)).toEqual([seller.user.id]);
    expect(filtered.body.pagination).toEqual({ total: 1, page: 1, limit: 1, totalPages: 1 });
    const email = await request(app)
      .get('/api/admin/users?search=alice-buyer')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(email.body.users.map((u: { id: number }) => u.id)).toEqual([customer.id]);
    const page = await request(app)
      .get('/api/admin/users?search=alice&page=2&limit=1')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(page.body.users.map((u: { id: number }) => u.id)).toEqual([customer.id]);
    const none = await request(app)
      .get('/api/admin/users?search=not-present')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(none.body).toMatchObject({
      users: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
    expect(filtered.body.users[0]).not.toHaveProperty('password');
    expect(filtered.body.users[0]).not.toHaveProperty('isBanned');
  });

  it('returns user details and seller product counters without exposing credentials', async () => {
    const { token } = await admin();
    const seller = await createSellerWithProfile({ isActive: false });
    await createProduct({ sellerProfileId: seller.profile.id });
    await createProduct({ sellerProfileId: seller.profile.id, stock: 0 });
    await createProduct({ sellerProfileId: seller.profile.id, isActive: false, stock: 0 });
    const response = await request(app)
      .get('/api/admin/users/' + seller.user.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(response.body).toMatchObject({
      id: seller.user.id,
      role: 'seller',
      sellerProfile: {
        id: seller.profile.id,
        isActive: false,
        products: { total: 3, active: 2, outOfStock: 1 },
      },
    });
    expect(response.body).not.toHaveProperty('password');
    const customer = await createUser();
    const plain = await request(app)
      .get('/api/admin/users/' + customer.id)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(plain.body.sellerProfile).toBeNull();
  });

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'limit=0',
    'limit=101',
    'limit=abc',
    'role=owner',
    'search=one&search=two',
    'role=seller&role=customer',
  ])('rejects invalid admin query %s', async (query) => {
    const { token } = await admin();
    const before = await User.count();
    const response = await request(app)
      .get('/api/admin/users?' + query)
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await User.count()).toBe(before);
  });

  it('bans and unbans an account, revoking an existing JWT without changing roles or commercial activity', async () => {
    const { token } = await admin();
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const path = `/api/admin/users/${seller.user.id}/ban`;
    const banned = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isBanned: true, role: 'admin' })
      .expect(200);
    expect(banned.body).toMatchObject({
      message: 'User banned successfully',
      user: { id: seller.user.id, role: 'seller', isBanned: true },
    });
    expect((await seller.user.reload()).isBanned).toBe(true);
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(403);
    await request(app)
      .post('/api/auth/login')
      .send({ email: seller.user.email, password: 'Password123' })
      .expect(403);
    expect((await seller.profile.reload()).isActive).toBe(true);
    expect((await product.reload()).isActive).toBe(true);
    const again = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isBanned: true })
      .expect(200);
    expect(again.body.message).toBe('User already has this status');
    await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isBanned: false })
      .expect(200);
    expect((await seller.user.reload()).isBanned).toBe(false);
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer ' + seller.token)
      .expect(200);
  });

  it('refuses changing ban status on self or another administrator', async () => {
    const actor = await admin();
    const other = await admin();
    for (const target of [actor, other])
      for (const isBanned of [true, false]) {
        const response = await request(app)
          .patch(`/api/admin/users/${target.user.id}/ban`)
          .set('Authorization', 'Bearer ' + actor.token)
          .send({ isBanned })
          .expect(403);
        expect(response.body.message).toBe('Administrators cannot be banned through this endpoint');
        expect((await target.user.reload()).isBanned).toBe(false);
      }
  });

  it('deactivates and reactivates a store independently from product flags and account bans', async () => {
    const { token } = await admin();
    const seller = await createSellerWithProfile();
    const product = await createProduct({ sellerProfileId: seller.profile.id });
    const inactiveProduct = await createProduct({
      sellerProfileId: seller.profile.id,
      isActive: false,
    });
    const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
    await Favorite.create({ userId: purchase.user.id, productId: product.id });
    const path = `/api/admin/sellers/${seller.profile.id}/status`;
    const disabled = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isActive: false })
      .expect(200);
    expect(disabled.body.sellerProfile).toMatchObject({ id: seller.profile.id, isActive: false });
    expect((await product.reload()).isActive).toBe(true);
    expect((await seller.user.reload()).isBanned).toBe(false);
    const catalog = await request(app).get('/api/products').expect(200);
    expect(catalog.body.data).toEqual([]);
    const favorites = await request(app)
      .get('/api/favorites')
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(favorites.body[0].product.availability).toBe('inactive');
    await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(403);
    expect((await purchase.order.reload()).status).toBe('pending');
    await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + seller.token)
      .send({
        cardId: product.cardId,
        condition: 'Near Mint',
        language: 'English',
        price: 25,
        stock: 1,
      })
      .expect(403);
    await request(app)
      .patch('/api/sellers/profile')
      .set('Authorization', 'Bearer ' + seller.token)
      .send({ storeName: 'Bypass' })
      .expect(403);
    const noChange = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isActive: false })
      .expect(200);
    expect(noChange.body.message).toBe('Seller store already has this status');
    await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ' + token)
      .send({ isActive: true })
      .expect(200);
    expect((await seller.profile.reload()).isActive).toBe(true);
    expect((await inactiveProduct.reload()).isActive).toBe(false);
    const restored = await request(app).get('/api/products').expect(200);
    expect(restored.body.data.map((p: { id: number }) => p.id)).toEqual([product.id]);
    await request(app)
      .post(`/api/orders/${purchase.order.id}/pay`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
  });

  it.each(['details', 'ban', 'seller-status'] as const)(
    'rejects invalid and nonexistent identifiers for %s',
    async (operation) => {
      const { token } = await admin();
      const method = operation === 'details' ? 'get' : 'patch';
      for (const id of ['abc', '0', '-1', '1.5', '999999']) {
        const path =
          operation === 'seller-status'
            ? `/api/admin/sellers/${id}/status`
            : `/api/admin/users/${id}` + (operation === 'ban' ? '/ban' : '');
        const response = await request(app)
          [method](path)
          .set('Authorization', 'Bearer ' + token)
          .send({ isActive: true, isBanned: true })
          .expect(id === '999999' ? 404 : 400);
        expect(response.body.message).toEqual(expect.any(String));
      }
    },
  );

  it.each(['ban', 'seller-status'] as const)(
    'rejects invalid %s payloads without changing the target',
    async (operation) => {
      const { token } = await admin();
      const seller = await createSellerWithProfile();
      const field = operation === 'ban' ? 'isBanned' : 'isActive';
      const path =
        operation === 'ban'
          ? `/api/admin/users/${seller.user.id}/ban`
          : `/api/admin/sellers/${seller.profile.id}/status`;
      for (const value of [undefined, null, 'true', 1])
        await request(app)
          .patch(path)
          .set('Authorization', 'Bearer ' + token)
          .send({ [field]: value })
          .expect(400);
      expect((await seller.user.reload()).isBanned).toBe(false);
      expect((await seller.profile.reload()).isActive).toBe(true);
    },
  );
});
