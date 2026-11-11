import { Card, OrderItem, SellerProfile, type Product } from '../../src/models/indexModel.js';

export const createOrderItem = async (
  orderId: number,
  product: Product,
  options: Partial<
    Pick<
      OrderItem,
      | 'quantity'
      | 'status'
      | 'unitPrice'
      | 'productName'
      | 'sellerName'
      | 'productId'
      | 'sellerProfileId'
    >
  > = {},
) => {
  const card = await Card.findByPk(product.cardId);
  const seller = await SellerProfile.findByPk(product.sellerProfileId);
  if (!card || !seller) throw new Error('Order-item fixture requires a real card and seller');
  return OrderItem.create({
    orderId,
    productId: product.id,
    sellerProfileId: seller.id,
    unitPrice: product.price,
    quantity: 1,
    productName: card.name,
    sellerName: seller.storeName,
    condition: product.condition,
    language: product.language,
    status: 'pending',
    ...options,
  });
};
