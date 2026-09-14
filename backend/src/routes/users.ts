import { Router } from 'express';

import { getMe, updateMe } from '../controllers/usersController.js';

import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';

import { updateMeSchema } from '../schemas/users.js';

const router = Router();

router.get('/me', auth, getMe);

router.patch('/me', auth, validate(updateMeSchema), updateMe);

export default router;
