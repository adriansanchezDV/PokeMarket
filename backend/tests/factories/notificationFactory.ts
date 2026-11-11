import { Notification } from '../../src/models/indexModel.js';

export const createNotification = (
  userId: number,
  options: Partial<
    Pick<
      Notification,
      'senderId' | 'productId' | 'type' | 'title' | 'message' | 'isRead' | 'createdAt'
    >
  > = {},
) =>
  Notification.create({
    userId,
    senderId: null,
    productId: null,
    type: 'TEST_EVENT',
    title: 'Testing notification',
    message: 'Testing message',
    isRead: false,
    ...options,
  });
