import { Router } from 'express';

import {
  getUserCart,
  addCartItem,
  updateCartItemQuantity,
  deleteCartItem,
  deleteCart,
} from '../controllers/cartController.js';

import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { updateCartItemSchema } from '../schemas/cartSchema.js';

const router = Router();

router.get('/', auth, getUserCart);

router.post('/items/:productId', auth, addCartItem);

router.patch('/items/:productId', auth, validate(updateCartItemSchema), updateCartItemQuantity);

router.delete('/items/:productId', auth, deleteCartItem);

router.delete('/', auth, deleteCart);

export default router;
