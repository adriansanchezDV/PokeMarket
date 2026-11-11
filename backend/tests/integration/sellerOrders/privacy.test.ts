import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { createSellerWithProfile } from '../../factories/sellerProfileFactory.js';
import { createProduct } from '../../factories/productFactory.js';
import { createPurchase, payPurchase } from '../../helpers/purchase.js';

const prepare = async () => {
  const seller = await createSellerWithProfile();
  const other = await createSellerWithProfile();
  const products = [
    await createProduct({ sellerProfileId: seller.profile.id }),
    await createProduct({ sellerProfileId: seller.profile.id }),
    await createProduct({ sellerProfileId: other.profile.id, price: 90 }),
  ];
  const purchase = await payPurchase(
    await createPurchase({ products: products.map((product) => ({ product, quantity: 1 })) }),
  );
  const owned = purchase.orderItems.filter((line) => line.sellerProfileId === seller.profile.id);
  const foreign = purchase.orderItems.find((line) => line.sellerProfileId === other.profile.id)!;
  return { seller, other, purchase, owned, foreign };
};

describe('Seller order response privacy', () => {
  it('omits global totals in each seller listing while the buyer retains the complete order', async () => {
    const { seller, other, purchase } = await prepare();
    for (const actor of [seller, other]) {
      const response = await request(app)
        .get('/api/seller/orders')
        .set('Authorization', 'Bearer ' + actor.token)
        .expect(200);
      expect(response.body.length).toBe(actor === seller ? 2 : 1);
      for (const line of response.body) {
        expect(line.sellerProfileId).toBe(actor.profile.id);
        expect(line.order).not.toHaveProperty('total');
        expect(line.order.shippingAddress).toEqual(purchase.order.shippingAddress);
      }
    }
    const buyer = await request(app)
      .get('/api/orders/' + purchase.order.id)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
    expect(buyer.body.total).toBe('140.00');
    expect(buyer.body.items).toHaveLength(3);
    expect((await purchase.order.reload()).total).toBe('140.00');
  });

  it('returns only owned lines on every transition and completes using all sellers lines', async () => {
    const { seller, other, purchase, owned, foreign } = await prepare();
    for (const line of owned) {
      for (const status of ['shipped', 'delivered']) {
        const response = await request(app)
          .patch(`/api/seller/orders/${line.id}/status`)
          .set('Authorization', 'Bearer ' + seller.token)
          .send({ status })
          .expect(200);
        expect(response.body.items.map((item: { id: number }) => item.id).sort()).toEqual(
          owned.map((item) => item.id).sort(),
        );
        expect(
          response.body.items.every(
            (item: { sellerProfileId: number }) => item.sellerProfileId === seller.profile.id,
          ),
        ).toBe(true);
        expect(response.body).not.toHaveProperty('total');
        expect(response.body.status).toBe('paid');
        expect((await foreign.reload()).status).toBe('processing');
      }
    }
    for (const status of ['shipped', 'delivered']) {
      const response = await request(app)
        .patch(`/api/seller/orders/${foreign.id}/status`)
        .set('Authorization', 'Bearer ' + other.token)
        .send({ status })
        .expect(200);
      expect(response.body.items.map((item: { id: number }) => item.id)).toEqual([foreign.id]);
      expect(response.body).not.toHaveProperty('total');
      expect(response.body.status).toBe(status === 'delivered' ? 'completed' : 'paid');
    }
    expect((await purchase.order.reload()).status).toBe('completed');
    expect((await purchase.order.reload()).total).toBe('140.00');
  });
});
