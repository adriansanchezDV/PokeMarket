import { SellerProfile } from '../../src/models/indexModel.js';
import { createToken, createUser } from '../helpers/userTestHelpers.js';

interface SellerProfileOptions {
  user?: Parameters<typeof createUser>[0];
  storeName?: string;
  description?: string | null;
  isActive?: boolean;
}

export const createSellerWithProfile = async (options: SellerProfileOptions = {}) => {
  const user = await createUser({ ...options.user, role: 'seller' });
  const profile = await SellerProfile.create({
    userId: user.id,
    storeName: options.storeName ?? `Test Store ${user.id}`,
    description: options.description === undefined ? 'Original description' : options.description,
    isActive: options.isActive ?? true,
  });
  return { user, profile, token: createToken(user) };
};
