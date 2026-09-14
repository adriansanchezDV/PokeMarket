import { Router } from 'express'
import {
  syncSingleCard,
  syncCardsFromSet,
} from '../controllers/cardsController.js'

const router = Router()

router.post('/:id/sync', syncSingleCard)
router.post('/set/:id/sync', syncCardsFromSet)

export default router