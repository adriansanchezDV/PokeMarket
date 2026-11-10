import { Router } from 'express';

import {
  getCards,
  getSingleCard,
  syncSingleCard,
  syncCardsFromSet,
} from '../controllers/cardsController.js';

import auth from '../middleware/auth.js';
import { syncRateLimit } from '../middleware/rateLimit.js';
import requireRole from '../middleware/requireRole.js';

const router = Router();

router.get('/', getCards);

router.get('/:id', getSingleCard);

router.post('/:id/sync', auth, requireRole('admin'), syncRateLimit, syncSingleCard);

router.post('/set/:id/sync', auth, requireRole('admin'), syncRateLimit, syncCardsFromSet);

export default router;
