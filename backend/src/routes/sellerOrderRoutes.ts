import { Router } from 'express';

import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';

import {
  getSellerOrdersController,
  updateSellerOrderItemStatusController,
} from '../controllers/sellerOrderController.js';
import { updateOrderItemStatusSchema } from '../schemas/orderSchema.js';
import validate from '../middleware/validate.js';

const router = Router();

router.get('/', auth, requireRole('seller'), getSellerOrdersController);

router.patch(
  '/:itemId/status',
  auth,
  requireRole('seller'),
  validate(updateOrderItemStatusSchema),
  updateSellerOrderItemStatusController,
);

export default router;
