import { describe, expect, it } from 'vitest';
import {
  assertTestEnvironment,
  classifyTestFile,
  resolveTestRedisUrl,
} from '../../helpers/testEnvironment.js';

const environment = {
  NODE_ENV: 'test',
  TEST_DB_NAME: 'pokemarket_test',
  DB_NAME: 'pokemarket',
};

describe('Testing environment safeguards', () => {
  it('accepts an explicitly isolated test database', () => {
    expect(() => assertTestEnvironment(environment)).not.toThrow();
  });
  it.each([
    { ...environment, NODE_ENV: 'development' },
    { ...environment, TEST_DB_NAME: undefined },
    { ...environment, TEST_DB_NAME: 'pokemarket' },
    { ...environment, DB_NAME: 'pokemarket_test' },
  ])('rejects an unsafe database environment', (value) => {
    expect(() => assertTestEnvironment(value)).toThrow();
  });
  it('requires Redis only when the Redis guard is requested', () => {
    expect(() => assertTestEnvironment(environment)).not.toThrow();
    expect(() => resolveTestRedisUrl(environment)).toThrow('TEST_REDIS_URL');
  });
  it.each([
    'redis://localhost:6379/0',
    'redis://different-user:different-password@127.0.0.1:6379/00',
    'rediss://[::1]:6379/0',
  ])('rejects equivalent Redis destinations without exposing credentials', (url) => {
    expect(() => resolveTestRedisUrl({ ...environment, TEST_REDIS_URL: url })).toThrow(
      'different server or Redis database',
    );
  });
  it('accepts an explicitly separate Redis database', () => {
    const value = { ...environment, TEST_REDIS_URL: 'redis://localhost:6379/1' };
    expect(resolveTestRedisUrl(value)).toBe(value.TEST_REDIS_URL);
  });
  it.each(['https://example.invalid', 'redis://localhost/not-a-database'])(
    'rejects invalid Redis URLs',
    (url) => {
      expect(() => resolveTestRedisUrl({ ...environment, TEST_REDIS_URL: url })).toThrow();
    },
  );
});

describe('Test file detection on Windows and POSIX', () => {
  it.each([
    ['C:\\repo\\tests\\integration\\app.test.ts', false],
    ['C:\\repo\\tests\\integration\\auth\\login.test.ts', false],
    ['C:\\repo\\tests\\integration\\infrastructure\\redis.redis.test.ts', true],
    ['C:/repo/tests/integration/infrastructure/redis.redis.test.ts', true],
    ['C:\\repo/tests\\integration/products/products.test.ts', false],
    ['tests\\integration\\infrastructure\\redis.redis.test.ts', true],
    ['/repo/tests/integration/products/products.test.ts', false],
  ] as const)('classifies %s', (path, redisRequired) => {
    expect(classifyTestFile(path)).toEqual({ redisRequired });
  });
  it.each([undefined, '', 'tests/setup.ts'])(
    'refuses an unknown file instead of skipping Redis safeguards',
    (path) => {
      expect(() => classifyTestFile(path)).toThrow('valid test file path');
    },
  );
});
