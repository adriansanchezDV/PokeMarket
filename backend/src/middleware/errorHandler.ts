import type { ErrorRequestHandler } from 'express';
import { UniqueConstraintError } from 'sequelize';

import { AppError } from '../utils/AppError.js';

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Request failed:', err instanceof Error ? err.name : 'UnknownError');

  if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  return res.status(500).json({
    error: 'Internal server error',
  });
};

export default errorHandler;
