import type { Request, Response } from 'express';

import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
} from '../services/notificationService.js';

export const create = async (req: Request, res: Response) => {
  try {
    const { userId, type, title, message } = req.body;

    const notification = await createNotification({
      userId,
      type,
      title,
      message,
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error creating notification',
    });
  }
};

export const getMine = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const notifications = await getUserNotifications(userId);

    res.json(notifications);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error fetching notifications',
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    const notification = await markNotificationAsRead(notificationId, userId);

    if (!notification) {
      res.status(404).json({
        message: 'Notification not found',
      });
      return;
    }

    res.json(notification);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error marking notification as read',
    });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const updatedCount = await markAllNotificationsAsRead(userId);

    res.json({
      message: 'Notifications marked as read',
      updatedCount,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error marking notifications as read',
    });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const count = await getUnreadNotificationsCount(userId);

    res.json({
      count,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error fetching unread notifications count',
    });
  }
};
