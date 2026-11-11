import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '../config/env.js';
import { User } from '../models/indexModel.js';
import { emailMatches } from '../utils/email.js';

export const authenticateUser = async (email: string, password: string) => {
  const users = await User.findAll({
    where: emailMatches(email),
    limit: 2,
  });

  if (users.length !== 1) {
    return null;
  }

  const [user] = users;

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
