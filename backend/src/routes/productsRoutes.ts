import { Router } from 'express';
import {
  createSingleProduct,
  deleteSingleProduct,
  getProducts,
  getSingleProduct,
  updateSingleProduct,
} from '../controllers/productsController.js';

import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../schemas/productsSchema.js';

const router = Router();

router.get('/', getProducts);

router.post('/', auth, requireRole('seller'), validate(createProductSchema), createSingleProduct);

router.patch(
  '/:id',
  auth,
  requireRole('seller'),
  validate(updateProductSchema),
  updateSingleProduct,
);

router.delete('/:id', auth, requireRole('seller'), deleteSingleProduct);

router.get('/:id', getSingleProduct);

export default router;
