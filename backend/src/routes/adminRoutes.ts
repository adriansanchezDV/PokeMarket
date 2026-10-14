import { Router } from 'express';

import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';
import {
  getAdminAccess,
  getAdminUserDetailsController,
  getDashboard,
  listAdminUsers,
  updateAdminSellerStatusController,
  updateAdminUserBanStatusController,
} from '../controllers/adminController.js';

const router = Router();

router.use(auth, requireRole('admin'));

router.get('/access', getAdminAccess);
router.get('/dashboard', getDashboard);
router.get('/users', listAdminUsers);
router.get('/users/:id', getAdminUserDetailsController);
router.patch('/sellers/:id/status', updateAdminSellerStatusController);
router.patch('/users/:id/ban', updateAdminUserBanStatusController);

export default router;
