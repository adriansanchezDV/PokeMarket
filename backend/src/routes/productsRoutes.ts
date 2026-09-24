import { Router } from 'express';

import {
  createSingleProduct,
  getProducts,
  getSellerProductsController,
  getSingleProduct,
  updateProductStatusController,
  updateSingleProduct,
} from '../controllers/productsController.js';

import auth from '../middleware/auth.js';
import requireRole from '../middleware/requireRole.js';
import validate from '../middleware/validate.js';

import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from '../schemas/productsSchema.js';

const router = Router();

router.get('/', getProducts);

router.post('/', auth, requireRole('seller'), validate(createProductSchema), createSingleProduct);


router.get('/seller', auth, requireRole('seller'), getSellerProductsController);

router.patch(
  '/:id/status',
  auth,
  requireRole('seller'),
  validate(updateProductStatusSchema),
  updateProductStatusController,
);

router.patch(
  '/:id',
  auth,
  requireRole('seller'),
  validate(updateProductSchema),
  updateSingleProduct,
);

router.get('/:id', getSingleProduct);

export default router;
