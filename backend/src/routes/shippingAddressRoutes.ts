import { Router } from 'express';

import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { createNewShippingAddress, deleteExistingShippingAddress, getShippingAddress, getShippingAddresses, setDefaultShippingAddressController, updateExistingShippingAddress } from '../controllers/shippingAddresController.js';
import { createShippingAddressSchema, updateShippingAddressSchema } from '../schemas/shippingAddressSchema.js';



const router = Router();

router.get('/', auth, getShippingAddresses);

router.get('/:id', auth, getShippingAddress);

router.post(
  '/',
  auth,
  validate(createShippingAddressSchema),
  createNewShippingAddress,
);

router.patch(
  '/:id',
  auth,
  validate(updateShippingAddressSchema),
  updateExistingShippingAddress,
);

router.delete('/:id', auth, deleteExistingShippingAddress);

router.patch(
  '/:id/default',
  auth,
  setDefaultShippingAddressController,
);

export default router;