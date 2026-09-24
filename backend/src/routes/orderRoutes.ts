import { Router } from 'express';

import auth from '../middleware/auth.js';
import {
  cancelOrderController,
  createNewOrder,
  getOrder,
  getOrders,
  payOrderController,
} from '../controllers/orderController.js';
import validate from '../middleware/validate.js';
import { createOrderSchema } from '../schemas/orderSchema.js';

const router = Router();

router.get('/', auth, getOrders);
router.post('/', auth, validate(createOrderSchema), createNewOrder);
router.post('/:id/pay', auth, payOrderController);
router.post('/:id/cancel', auth, cancelOrderController);
router.get('/:id', auth, getOrder);

export default router;
