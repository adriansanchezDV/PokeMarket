import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '../config/env.js';
import { User } from '../models/indexModel.js';

export const authenticateUser = async (email: string, password: string) => {
  const user = await User.findOne({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const passwordCorrect = await bcrypt.compare(password, user.password);

  if (!passwordCorrect) {
    return null;
  }

  return user;
};

export const generateAuthToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );
};
