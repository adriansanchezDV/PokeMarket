import type { RequestHandler } from 'express';

const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
};

export default notFound;
