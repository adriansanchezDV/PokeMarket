import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

const optionalAuth: RequestHandler = (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization) {
    return next();
  }

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Invalid authorization header',
    });
  }

  const token = authorization.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (
      typeof decoded === 'string' ||
      typeof decoded.id !== 'number' ||
      typeof decoded.email !== 'string' ||
      !['customer', 'seller', 'admin'].includes(decoded.role as string)
    ) {
      return res.status(401).json({
        error: 'Invalid token payload',
      });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role as 'customer' | 'seller' | 'admin',
    };

    return next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
};

export default optionalAuth;
