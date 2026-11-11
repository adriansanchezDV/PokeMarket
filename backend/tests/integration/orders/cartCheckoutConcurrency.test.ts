import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { Cart, CartItem, Order, OrderItem } from '../../../src/models/indexModel.js';
import { createProduct } from '../../factories/productFactory.js';
import { createUser, createToken } from '../../helpers/userTestHelpers.js';
import { prepareCheckout } from '../../helpers/purchase.js';
import { withOrderRowLock } from '../../helpers/orderConcurrency.js';

describe('Checkout versus concurrent cart modifications', () => {
  it.each(['same-product', 'different-products'] as const)(
    'creates one previously nonexistent cart for concurrent additions of %s',
    async (scenario) => {
      const user = await createUser();
      const token = createToken(user);
      const first = await createProduct({ stock: 5 });
      const second = scenario === 'same-product' ? first : await createProduct({ stock: 5 });
      const responses = await withOrderRowLock('users', user.id, async (gate) => {
        for (const [index, product] of [first, second].entries()) {
          gate.start(
            request(app)
              .post('/api/cart/items/' + product.id)
              .set('Authorization', 'Bearer ' + token),
          );
          await gate.waitForBlocked(index + 1);
        }
      });
      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      expect(await Cart.count({ where: { userId: user.id } })).toBe(1);
      const items = await CartItem.findAll({ order: [['productId', 'ASC']] });
      expect(items.map((item) => ({ productId: item.productId, quantity: item.quantity }))).toEqual(
        scenario === 'same-product'
          ? [{ productId: first.id, quantity: 2 }]
          : [
              { productId: first.id, quantity: 1 },
              { productId: second.id, quantity: 1 },
            ],
      );
      expect((await first.reload()).stock).toBe(5);
      expect((await second.reload()).stock).toBe(5);
    },
    15_000,
  );

  it.each(['reduce', 'remove', 'clear', 'add'] as const)(
    'serializes %s before checkout with the acknowledged change included',
    async (operation) => {
      const product = await createProduct({ stock: 5 });
      const checkout = await prepareCheckout({ products: [{ product, quantity: 2 }] });
      const responses = await withOrderRowLock('carts', checkout.cart.id, async (gate) => {
        const path = '/api/cart/items/' + product.id;
        const mutation =
          operation === 'reduce'
            ? request(app).patch(path).send({ quantity: 1 })
            : operation === 'add'
              ? request(app).post(path)
              : request(app).delete(operation === 'clear' ? '/api/cart' : path);
        gate.start(mutation.set('Authorization', 'Bearer ' + checkout.token));
        await gate.waitForBlocked(1);
        gate.start(
          request(app)
            .post('/api/orders')
            .set('Authorization', 'Bearer ' + checkout.token)
            .send({ shippingAddressId: checkout.address.id }),
        );
        await gate.waitForBlocked(2);
      });
      expect(responses[0].status).toBe(
        operation === 'remove' || operation === 'clear' ? 204 : operation === 'add' ? 201 : 200,
      );
      if (operation === 'remove' || operation === 'clear') {
        expect(responses[1].status).toBe(409);
        expect(await Order.count()).toBe(0);
      } else {
        expect(responses[1].status).toBe(201);
        const item = await OrderItem.findOne({ where: { orderId: responses[1].body.id } });
        expect(item?.quantity).toBe(operation === 'reduce' ? 1 : 3);
      }
      expect(await CartItem.count()).toBe(0);
      expect((await product.reload()).stock).toBe(5);
    },
    15_000,
  );

  it.each(['reduce', 'remove', 'clear', 'add'] as const)(
    'serializes %s after checkout without silently losing a successful mutation',
    async (operation) => {
      const product = await createProduct({ stock: 5 });
      const checkout = await prepareCheckout({ products: [{ product, quantity: 2 }] });
      const responses = await withOrderRowLock('carts', checkout.cart.id, async (gate) => {
        gate.start(
          request(app)
            .post('/api/orders')
            .set('Authorization', 'Bearer ' + checkout.token)
            .send({ shippingAddressId: checkout.address.id }),
        );
        await gate.waitForBlocked(1);
        const path = '/api/cart/items/' + product.id;
        const mutation =
          operation === 'reduce'
            ? request(app).patch(path).send({ quantity: 1 })
            : operation === 'add'
              ? request(app).post(path)
              : request(app).delete(operation === 'clear' ? '/api/cart' : path);
        gate.start(mutation.set('Authorization', 'Bearer ' + checkout.token));
        await gate.waitForBlocked(2);
      });
      expect(responses[0].status).toBe(201);
      expect(
        (await OrderItem.findOne({ where: { orderId: responses[0].body.id } }))?.quantity,
      ).toBe(2);
      expect(responses[1].status).toBe(
        operation === 'clear' ? 204 : operation === 'add' ? 201 : 404,
      );
      const remaining = await CartItem.findAll();
      expect(
        remaining.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      ).toEqual(operation === 'add' ? [{ productId: product.id, quantity: 1 }] : []);
      expect((await product.reload()).stock).toBe(5);
    },
    15_000,
  );

  it('does not lose a quantity reduction acknowledged while checkout waits on its seller', async () => {
    const product = await createProduct({ stock: 5 });
    const checkout = await prepareCheckout({ products: [{ product, quantity: 2 }] });
    let sequence: 'blocked' | 'settled' | undefined;
    const responses = await withOrderRowLock(
      'seller_profiles',
      product.sellerProfileId,
      async (gate) => {
        gate.start(
          request(app)
            .post('/api/orders')
            .set('Authorization', 'Bearer ' + checkout.token)
            .send({ shippingAddressId: checkout.address.id }),
        );
        await gate.waitForBlocked(1);
        const mutation = gate.start(
          request(app)
            .patch('/api/cart/items/' + product.id)
            .set('Authorization', 'Bearer ' + checkout.token)
            .send({ quantity: 1 }),
        );
        sequence = await gate.waitForBlocked(2, mutation);
      },
    );
    expect(responses[0].status).toBe(201);
    const item = await OrderItem.findOne({ where: { orderId: responses[0].body.id } });
    if (sequence === 'settled') {
      expect(responses[1].status).toBe(200);
      expect({
        acknowledgedQuantity: responses[1].body.quantity,
        orderedQuantity: item?.quantity,
      }).toEqual({ acknowledgedQuantity: 1, orderedQuantity: 1 });
    } else {
      expect(responses[1].status).toBe(404);
      expect(item?.quantity).toBe(2);
    }
    expect(await CartItem.count()).toBe(0);
    expect((await product.reload()).stock).toBe(5);
  }, 15_000);

  it.each(['remove', 'clear'] as const)(
    'does not order items whose %s was acknowledged before checkout resumed',
    async (operation) => {
      const checkout = await prepareCheckout();
      const product = checkout.products[0].product;
      let sequence: 'blocked' | 'settled' | undefined;
      const responses = await withOrderRowLock(
        'seller_profiles',
        product.sellerProfileId,
        async (gate) => {
          gate.start(
            request(app)
              .post('/api/orders')
              .set('Authorization', 'Bearer ' + checkout.token)
              .send({ shippingAddressId: checkout.address.id }),
          );
          await gate.waitForBlocked(1);
          const mutation = gate.start(
            request(app)
              .delete(operation === 'clear' ? '/api/cart' : '/api/cart/items/' + product.id)
              .set('Authorization', 'Bearer ' + checkout.token),
          );
          sequence = await gate.waitForBlocked(2, mutation);
        },
      );
      if (sequence === 'settled') {
        expect(responses[1].status).toBe(204);
        expect({ checkoutStatus: responses[0].status, orders: await Order.count() }).toEqual({
          checkoutStatus: 409,
          orders: 0,
        });
      } else {
        expect(responses[0].status).toBe(201);
        expect(responses[1].status).toBe(operation === 'clear' ? 204 : 404);
        expect(await Order.count()).toBe(1);
      }
      expect(await CartItem.count()).toBe(0);
    },
    15_000,
  );
});
