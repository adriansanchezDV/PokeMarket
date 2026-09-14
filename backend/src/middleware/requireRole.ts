import type { RequestHandler } from 'express';

type Role = 'customer' | 'seller' | 'admin';

const requireRole = (role: Role): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};

export default requireRole;
