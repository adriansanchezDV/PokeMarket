import { Router } from 'express';

import {
  createSellerProfile,
  getSellerProfile,
  updateSellerProfile,
} from '../controllers/sellerProfilesController.js';

import auth from '../middleware/auth.js';

import validate from '../middleware/validate.js';

import requireRole from '../middleware/requireRole.js';
import {
  createSellerProfileSchema,
  updateSellerProfileSchema,
} from '../schemas/sellerProfilesSchema.js';

const router = Router();

router.post(
  '/profile',
  auth,
  requireRole('seller'),
  validate(createSellerProfileSchema),
  createSellerProfile,
  getSellerProfile,
  updateSellerProfile,
);

router.patch(
  '/profile',
  auth,
  requireRole('seller'),
  validate(updateSellerProfileSchema),
  updateSellerProfile,
);

router.get('/:id', getSellerProfile);

export default router;
