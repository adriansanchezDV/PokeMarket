import { Router } from 'express';

import { getStores, getStoreById, getStoreProducts } from '../controllers/storeController.js';

const router = Router();

router.get('/', getStores);
router.get('/:id/products', getStoreProducts);
router.get('/:id', getStoreById);

export default router;
