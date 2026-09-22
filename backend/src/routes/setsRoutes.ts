import { Router } from 'express';
import { getAllSets } from '../services/setsService.js';
import { getSingleSet, syncSingleSet } from '../controllers/setsController.js';

const router = Router();

router.get('/', getAllSets);
router.get('/:id', getSingleSet);
router.post('/:id/sync', syncSingleSet);

export default router;
