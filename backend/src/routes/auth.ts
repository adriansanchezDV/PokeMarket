import { Router } from 'express';
import auth from '../middleware/auth.js';

import { register, login } from '../controllers/authController.js';

import validate from '../middleware/validate.js';

import { registerSchema, loginSchema } from '../schemas/auth.js';
import requireRole from '../middleware/requireRole.js';

const router = Router();

router.get('/seller-test', auth, requireRole('seller'), (_req, res) => {
  res.json({ message: 'Seller access granted' });
});

router.post('/register', validate(registerSchema), register);

router.post('/login', validate(loginSchema), login);

export default router;
