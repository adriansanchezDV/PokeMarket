import { Order } from '../../src/models/indexModel.js';
import { shippingAddressSnapshot } from './shippingAddressFactory.js';

// Direct fixtures are for queries and malformed historical data, not payment effects.
export const createOrder = (
  userId: number,
  options: Partial<Pick<Order, 'status' | 'total' | 'shippingAddress'>> = {},
) =>
  Order.create({
    userId,
    status: 'pending',
    total: '25.00',
    shippingAddress: { ...shippingAddressSnapshot },
    ...options,
  });
