import { rateLimit } from 'express-rate-limit';

const commonOptions = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many requests, please try again later' },
};

export const loginRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  ipv6Subnet: 56,
});

export const registerRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  ipv6Subnet: 56,
});

export const syncRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.user!.id),
});
