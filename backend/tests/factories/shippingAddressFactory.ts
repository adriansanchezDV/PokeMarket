import { ShippingAddress } from '../../src/models/indexModel.js';
import type Order from '../../src/models/OrderModel.js';

export const shippingAddressSnapshot: Order['shippingAddress'] = {
  recipientName: 'Test Buyer',
  street: 'Test Street 123',
  city: 'Madrid',
  postalCode: '28001',
  province: 'Madrid',
  country: 'Spain',
  phone: '600123456',
};

export const createShippingAddress = (
  userId: number,
  overrides: Partial<Order['shippingAddress'] & { isDefault: boolean }> = {},
) => ShippingAddress.create({ ...shippingAddressSnapshot, userId, isDefault: true, ...overrides });
