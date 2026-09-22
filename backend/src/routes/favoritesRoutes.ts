import { Router } from 'express';

import auth from '../middleware/auth.js';

import {
  getFavorites,
  createFavorite,
  deleteFavorite,
} from '../controllers/favoritesController.js';

const router = Router();

router.get('/', auth, getFavorites);

router.post('/:productId', auth, createFavorite);

router.delete('/:productId', auth, deleteFavorite);

export default router;
