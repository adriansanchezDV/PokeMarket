import { Router } from 'express';
import { getAllSets, getSingleSet, syncSingleSet } from '../controllers/setsController.js';

import auth from '../middleware/auth.js';
import { syncRateLimit } from '../middleware/rateLimit.js';
import requireRole from '../middleware/requireRole.js';

const router = Router();

router.get('/', getAllSets);
router.get('/:id', getSingleSet);
router.post('/:id/sync', auth, requireRole('admin'), syncRateLimit, syncSingleSet);

export default router;
