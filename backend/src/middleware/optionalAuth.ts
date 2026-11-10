import type { RequestHandler } from 'express';
import auth from './auth.js';

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

  return auth(req, res, next);
};

export default optionalAuth;
