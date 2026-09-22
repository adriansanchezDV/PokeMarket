import { Router } from 'express';

import {
  getCards,
  getSingleCard,
  syncSingleCard,
  syncCardsFromSet,
} from '../controllers/cardsController.js';

const router = Router();

router.get('/', getCards);

router.get('/:id', getSingleCard);

router.post('/:id/sync', syncSingleCard);

router.post('/set/:id/sync', syncCardsFromSet);

export default router;
