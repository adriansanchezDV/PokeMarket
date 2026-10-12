import { Transaction } from 'sequelize/lib/transaction';
import { Card, Favorite, Product, SellerProfile, User } from '../models/indexModel.js';
import Notification from '../models/NotificationModel.js';

interface CreateNotificationData {
  userId: number;
  senderId?: number | null;
  productId?: number | null;
  type: string;
  title: string;
  message: string;
  transaction?: Transaction;
}

export const createNotification = async ({
  userId,
  senderId = null,
  productId = null,
  type,
  title,
  message,
  transaction,
}: CreateNotificationData) => {
  return Notification.create(
    {
      userId,
      senderId,
      productId,
      type,
      title,
      message,
    },
    { transaction },
  );
};

export const getUserNotifications = async (userId: number) => {
  return Notification.findAll({
    where: {
      userId,
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'fullName'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
};
export const markNotificationAsRead = async (notificationId: number, userId: number) => {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    return null;
  }

  if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }

  return notification;
};

export const markAllNotificationsAsRead = async (userId: number) => {
  const [updatedCount] = await Notification.update(
    {
      isRead: true,
    },
    {
      where: {
        userId,
        isRead: false,
      },
    },
  );

  return updatedCount;
};

export const getUnreadNotificationsCount = async (userId: number) => {
  return Notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};

export const notifyFavoriteUsersAboutRestock = async (productId: number) => {
  const product = await Product.findByPk(productId, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['name'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'userId'],
      },
    ],
  });

  if (!product) {
    return 0;
  }

  const favorites = await Favorite.findAll({
    where: {
      productId,
    },
    attributes: ['userId'],
  });

  const recipients = favorites.filter(
    (favorite) => favorite.userId !== product.sellerProfile?.userId,
  );

  await Promise.all(
    recipients.map((favorite) =>
      createNotification({
        userId: favorite.userId,
        productId,
        type: 'favorite_restock',
        title: '¡Producto disponible!',
        message: `${product.card?.name ?? 'El producto'} vuelve a estar disponible en stock.`,
      }),
    ),
  );

  return recipients.length;
};

export const notifyFavoriteUsersAboutPriceDrop = async (
  productId: number,
  oldPrice: number,
  newPrice: number,
) => {
  const product = await Product.findByPk(productId, {
    include: [
      {
        model: Card,
        as: 'card',
        attributes: ['name'],
      },
      {
        model: SellerProfile,
        as: 'sellerProfile',
        attributes: ['id', 'userId'],
      },
    ],
  });

  if (!product) {
    return 0;
  }

  const favorites = await Favorite.findAll({
    where: {
      productId,
    },
    attributes: ['userId'],
  });

  const recipients = favorites.filter(
    (favorite) => favorite.userId !== product.sellerProfile?.userId,
  );

  await Promise.all(
    recipients.map((favorite) =>
      createNotification({
        userId: favorite.userId,
        productId,
        type: 'favorite_price_drop',
        title: '¡Bajada de precio!',
        message: `${product.card?.name ?? 'El producto'} ha bajado de ${oldPrice.toFixed(
          2,
        )} € a ${newPrice.toFixed(2)} €.`,
      }),
    ),
  );

  return recipients.length;
};
