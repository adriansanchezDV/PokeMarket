import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createOrder } from '../../factories/orderFactory.js';
import { createOrderItem } from '../../factories/orderItemFactory.js';
import { createReview } from '../../factories/reviewFactory.js';
import { createUser } from '../../helpers/userTestHelpers.js';

describe('Public stores', () => {
  it('returns an empty list and validates missing or invalid stores', async () => {
    expect((await request(app).get('/api/stores').expect(200)).body).toEqual([]);
    for (const suffix of ['', '/products']) {
      await request(app)
        .get('/api/stores/999999' + suffix)
        .expect(404);
      for (const id of ['0', '-1', 'abc', '1.5'])
        await request(app)
          .get('/api/stores/' + id + suffix)
          .expect(400);
    }
  });

  it('counts confirmed units across products/orders without pending sales or cross-store contamination', async () => {
    const seller = await createSellerWithProfile();
    const first = await createProduct({ sellerProfileId: seller.profile.id });
    const second = await createProduct({ sellerProfileId: seller.profile.id });
    const other = await createProduct();
    const buyer = await createUser();
    for (const [orderStatus, status, quantity] of [
      ['pending', 'pending', 5],
      ['paid', 'processing', 2],
      ['paid', 'shipped', 3],
      ['completed', 'delivered', 4],
      ['cancelled', 'cancelled', 7],
    ] as const) {
      const order = await createOrder(buyer.id, { status: orderStatus });
      await createOrderItem(order.id, quantity === 4 ? second : first, { status, quantity });
    }
    await createOrderItem((await createOrder(buyer.id)).id, first, {
      status: 'processing',
      quantity: 9,
    });
    await createOrderItem((await createOrder(buyer.id, { status: 'paid' })).id, other, {
      status: 'processing',
      quantity: 1,
    });
    await createReview(buyer.id, first.id, { rating: 5 });
    await createReview((await createUser()).id, second.id, { rating: 3 });
    await createReview(buyer.id, other.id, { rating: 1 });
    const detail = await request(app)
      .get('/api/stores/' + seller.profile.id)
      .expect(200);
    expect(detail.body).toMatchObject({
      id: seller.profile.id,
      productCount: 2,
      salesCount: 9,
      reviewCount: 2,
      averageRating: 4,
    });
    const list = await request(app).get('/api/stores').expect(200);
    expect(list.body.find((store: { id: number }) => store.id === seller.profile.id)).toEqual(
      detail.body,
    );
    expect(
      list.body.find((store: { id: number }) => store.id === other.sellerProfileId),
    ).toMatchObject({ salesCount: 1, reviewCount: 1, averageRating: 1 });
  });

  it('preserves public profile visibility and historical sales but hides inactive offers', async () => {
    const seller = await createSellerWithProfile();
    const active = await createProduct({ sellerProfileId: seller.profile.id, stock: 0 });
    await createProduct({ sellerProfileId: seller.profile.id, isActive: false });
    const order = await createOrder((await createUser()).id, { status: 'completed' });
    await createOrderItem(order.id, active, { status: 'delivered', quantity: 2 });
    const products = await request(app)
      .get(`/api/stores/${seller.profile.id}/products`)
      .expect(200);
    expect(products.body.map((product: { id: number }) => product.id)).toEqual([active.id]);
    expect(products.body[0]).toMatchObject({
      stock: 0,
      isActive: true,
      card: { id: active.cardId },
    });
    await seller.profile.update({ isActive: false });
    const disabled = await request(app)
      .get('/api/stores/' + seller.profile.id)
      .expect(200);
    expect(disabled.body).toMatchObject({ isActive: false, productCount: 0, salesCount: 2 });
    expect(
      (await request(app).get(`/api/stores/${seller.profile.id}/products`).expect(200)).body,
    ).toEqual([]);
    expect((await request(app).get('/api/stores').expect(200)).body).toHaveLength(1);
  });
});
