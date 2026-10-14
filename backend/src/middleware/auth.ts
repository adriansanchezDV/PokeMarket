import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { User } from '../models/indexModel.js';

const auth: RequestHandler = async (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Token missing',
    });
    return;
  }

  const token = authorization.replace('Bearer ', '');

  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token',
    });
    return;
  }

  if (
    typeof decoded === 'string' ||
    typeof decoded.id !== 'number' ||
    typeof decoded.email !== 'string' ||
    !['customer', 'seller', 'admin'].includes(decoded.role as string)
  ) {
    res.status(401).json({
      error: 'Invalid token payload',
    });
    return;
  }

  try {
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'isBanned'],
    });

    if (!user) {
      res.status(401).json({
        error: 'User account not found',
      });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({
        error: 'User account is banned',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Error checking authenticated user:', error);

    res.status(500).json({
      error: 'Error validating user account',
    });
  }
};

export default auth;
