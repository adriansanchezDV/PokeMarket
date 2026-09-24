import { Router } from 'express';

import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';

import { getSellerStatsController } from '../controllers/sellerStatsController.js';

const router = Router();

router.get(
  '/',
  auth,
  requireRole('seller'),
  getSellerStatsController,
);

export default router;