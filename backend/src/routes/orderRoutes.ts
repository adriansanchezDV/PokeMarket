import { Router } from 'express';

import auth from '../middleware/auth.js';
import { createNewOrder, getOrder, getOrders } from '../controllers/orderController.js';

const router = Router();

router.get('/', auth, getOrders);
router.post('/', auth, createNewOrder);
router.get('/:id', auth, getOrder);


export default router;
