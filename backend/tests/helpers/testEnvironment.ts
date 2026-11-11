import { config as loadEnv, parse } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const testDatabaseName = 'pokemarket_test';
const disabledRedisUrl = 'redis://127.0.0.1:1/0';
let originalRedisUrl: string | undefined;

export const loadTestEnvironmentFiles = () => {
  loadEnv({ path: [projectRoot + '.env.test', projectRoot + '.env'], quiet: true });
  originalRedisUrl ??= process.env.REDIS_URL ?? 'redis://localhost:6379';
};

export const assertTestEnvironment = (environment: NodeJS.ProcessEnv = process.env) => {
  if (environment.NODE_ENV !== 'test') {
    throw new Error('Testing requires NODE_ENV=test');
  }
  if (environment.TEST_DB_NAME !== testDatabaseName) {
    throw new Error('TEST_DB_NAME must explicitly be pokemarket_test');
  }
  if (environment.DB_NAME?.trim() === testDatabaseName) {
    throw new Error('TEST_DB_NAME must differ from DB_NAME');
  }
};

const redisDestination = (value: string) => {
  try {
    const url = new URL(value);
    const database = url.pathname === '' || url.pathname === '/' ? '0' : url.pathname.slice(1);
    if (
      !['redis:', 'rediss:'].includes(url.protocol) ||
      !url.hostname ||
      url.search ||
      url.hash ||
      !/^\d+$/.test(database) ||
      !Number.isSafeInteger(Number(database))
    ) {
      throw new Error();
    }
    const hostname = url.hostname.toLowerCase();
    const host = ['localhost', '127.0.0.1', '[::1]', '[::ffff:7f00:1]'].includes(hostname)
      ? 'loopback'
      : hostname;
    return host + ':' + (url.port || '6379') + '/' + Number(database);
  } catch {
    throw new Error('Redis testing URLs must be valid redis:// or rediss:// URLs');
  }
};

export const resolveTestRedisUrl = (
  environment: NodeJS.ProcessEnv,
  developmentUrls = [environment.REDIS_URL ?? 'redis://localhost:6379'],
) => {
  assertTestEnvironment(environment);
  const url = environment.TEST_REDIS_URL;
  if (!url) throw new Error('Redis integration tests require an explicit TEST_REDIS_URL');
  const destination = redisDestination(url);
  if (developmentUrls.some((developmentUrl) => redisDestination(developmentUrl) === destination)) {
    throw new Error('TEST_REDIS_URL must use a different server or Redis database');
  }
  return url;
};

export const getConfiguredTestRedisUrl = () => {
  const developmentFile = projectRoot + '.env';
  const fileRedisUrl = existsSync(developmentFile)
    ? parse(readFileSync(developmentFile)).REDIS_URL
    : undefined;
  return resolveTestRedisUrl(process.env, [
    originalRedisUrl ?? 'redis://localhost:6379',
    fileRedisUrl ?? 'redis://localhost:6379',
  ]);
};

export const configureTestRedis = (required: boolean) => {
  process.env.REDIS_URL = required ? getConfiguredTestRedisUrl() : disabledRedisUrl;
};

export const classifyTestFile = (path: string | undefined) => {
  if (!path || !path.endsWith('.test.ts')) {
    throw new Error('Vitest did not provide a valid test file path');
  }
  const normalizedPath = '/' + path.replaceAll('\\', '/');
  return {
    redisRequired: normalizedPath.endsWith('.redis.test.ts'),
  };
};
