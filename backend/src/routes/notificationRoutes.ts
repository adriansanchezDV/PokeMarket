import { Router } from 'express';

import auth from '../middleware/auth.js';

import {
  getMine,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', auth, getMine);

router.get('/unread-count', auth, getUnreadCount);

router.patch('/read-all', auth, markAllAsRead);

router.patch('/:id/read', auth, markAsRead);

export default router;
