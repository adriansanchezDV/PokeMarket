import { Cart, CartItem, type Product, type User } from '../../src/models/indexModel.js';
import { createToken, createUser } from '../helpers/userTestHelpers.js';

export const createCart = async (
  options: {
    user?: User;
    products?: { product: Product; quantity: number }[];
  } = {},
) => {
  const user = options.user ?? (await createUser());
  const cart = await Cart.create({ userId: user.id });
  const items = await CartItem.bulkCreate(
    (options.products ?? []).map(({ product, quantity }) => ({
      cartId: cart.id,
      productId: product.id,
      quantity,
    })),
  );
  return { user, token: createToken(user), cart, items };
};
