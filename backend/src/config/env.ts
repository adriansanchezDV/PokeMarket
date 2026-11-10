import 'dotenv/config';
import { isIP } from 'node:net';
import { z } from 'zod';

const nonEmptyString = z.string().refine((value) => value.trim().length > 0);
const port = z.coerce.number().int().min(1).max(65535);

const trustedProxies = z
  .string()
  .default('false')
  .transform((value, context) => {
    if (value === 'false') return false;

    const proxies = value.split(',').map((proxy) => proxy.trim());
    const valid = proxies.every((proxy) => {
      const [address, prefix, ...rest] = proxy.split('/');
      const version = isIP(address);
      if (!version || rest.length > 0) return false;
      if (prefix === undefined) return true;
      return (
        /^\d+$/.test(prefix) && Number(prefix) >= 1 && Number(prefix) <= (version === 4 ? 32 : 128)
      );
    });

    if (!valid) {
      context.addIssue({ code: 'custom', message: 'Expected explicit proxy IPs or CIDRs' });
      return z.NEVER;
    }
    return proxies;
  });

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: port.default(3001),
    JWT_SECRET: nonEmptyString,
    DB_HOST: z.string().trim().min(1),
    DB_PORT: port,
    DB_NAME: z.string().trim().min(1).optional(),
    DB_USER: nonEmptyString,
    DB_PASSWORD: nonEmptyString,
    TEST_DB_NAME: z.literal('pokemarket_test').optional(),
    REDIS_URL: z
      .string()
      .default('redis://localhost:6379')
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            ['redis:', 'rediss:'].includes(url.protocol) &&
            url.hostname.length > 0 &&
            (!url.port || Number(url.port) >= 1) &&
            (!url.pathname || url.pathname === '/' || /^\/\d+$/.test(url.pathname)) &&
            !url.search &&
            !url.hash
          );
        } catch {
          return false;
        }
      }),
    TRUST_PROXY: trustedProxies,
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'test') {
      if (environment.TEST_DB_NAME !== 'pokemarket_test') {
        context.addIssue({
          code: 'custom',
          path: ['TEST_DB_NAME'],
          message: 'Test database required',
        });
      }
      if (environment.DB_NAME === environment.TEST_DB_NAME) {
        context.addIssue({
          code: 'custom',
          path: ['DB_NAME'],
          message: 'Test database must be separate',
        });
      }
    } else if (!environment.DB_NAME) {
      context.addIssue({ code: 'custom', path: ['DB_NAME'], message: 'Database name required' });
    }

    if (environment.NODE_ENV === 'production' && environment.JWT_SECRET.length < 32) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'At least 32 characters required in production',
      });
    }
  });

const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error('Invalid environment configuration: ' + fields.join(', '));
}

export default result.data;
