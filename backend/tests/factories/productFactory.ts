import { Product } from '../../src/models/indexModel.js';
import { createCard } from './cardFactory.js';
import { createSellerWithProfile } from './sellerProfileFactory.js';

interface ProductOptions {
  sellerProfileId?: number;
  cardId?: number;
  condition?: string;
  language?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
  description?: string | null;
}

export const createProduct = async (options: ProductOptions = {}) => {
  const cardId = options.cardId ?? (await createCard()).id;
  const sellerProfileId = options.sellerProfileId ?? (await createSellerWithProfile()).profile.id;
  return Product.create({
    condition: 'Near Mint',
    language: 'English',
    price: 25,
    stock: 3,
    isActive: true,
    ...options,
    cardId,
    sellerProfileId,
  });
};
