import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '../../src/config/env.js';
import { User } from '../../src/models/indexModel.js';

type UserRole = 'customer' | 'seller' | 'admin';

interface CreateUserOptions {
  password?: string;
  fullName?: string | null;
  email?: string;
  role?: UserRole;
  isBanned?: boolean;
}

interface TokenUser {
  id: number;
  email: string;
  role: UserRole;
}

let userSequence = 0;

export const resetUserSequence = () => {
  userSequence = 0;
};

export const createUser = async (overrides: CreateUserOptions = {}) => {
  const { password: plainPassword = 'Password123', ...attributes } = overrides;
  const password = await bcrypt.hash(plainPassword, 10);

  return User.create({
    fullName: 'Test User',
    email: `user-${++userSequence}@example.com`,
    password,
    role: 'customer',
    isBanned: false,
    ...attributes,
  });
};

export const createToken = (
  user: TokenUser,
  options: Pick<jwt.SignOptions, 'expiresIn'> = {},
): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: '1h', ...options },
  );
};
