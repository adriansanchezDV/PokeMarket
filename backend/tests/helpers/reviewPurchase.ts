import request from 'supertest';
import app from '../../src/app.js';
import { createSellerWithProfile } from '../factories/sellerProfileFactory.js';
import { createProduct } from '../factories/productFactory.js';
import { createPurchase, payPurchase } from './purchase.js';

export const createReviewPurchase = async (
  state: 'pending' | 'paid' | 'completed' | 'cancelled' = 'completed',
) => {
  const seller = await createSellerWithProfile();
  const product = await createProduct({ sellerProfileId: seller.profile.id });
  const purchase = await createPurchase({ products: [{ product, quantity: 1 }] });
  if (state === 'paid' || state === 'completed') await payPurchase(purchase);
  if (state === 'cancelled')
    await request(app)
      .post(`/api/orders/${purchase.order.id}/cancel`)
      .set('Authorization', 'Bearer ' + purchase.token)
      .expect(200);
  if (state === 'completed') {
    for (const status of ['shipped', 'delivered'])
      await request(app)
        .patch(`/api/seller/orders/${purchase.orderItems[0].id}/status`)
        .set('Authorization', 'Bearer ' + seller.token)
        .send({ status })
        .expect(200);
  }
  return { ...purchase, seller, product };
};
