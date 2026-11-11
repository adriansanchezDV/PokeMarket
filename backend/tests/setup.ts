import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { ipKeyGenerator } from 'express-rate-limit';
import { QueryTypes } from 'sequelize';
import {
  assertTestEnvironment,
  classifyTestFile,
  configureTestRedis,
  loadTestEnvironmentFiles,
} from './helpers/testEnvironment.js';
import { assertSafeTestDatabase } from './helpers/testDatabaseControl.js';
import { cleanTestRedis, closeTestRedis, connectTestRedis } from './helpers/testRedis.js';

loadTestEnvironmentFiles();
assertTestEnvironment();
const { redisRequired } = classifyTestFile(expect.getState().testPath);
configureTestRedis(redisRequired);

const { default: sequelize, cleanTestDatabase } = await import('./helpers/testDatabase.js');
const { resetUserSequence } = await import('./helpers/userTestHelpers.js');
const { resetCatalogSequence } = await import('./factories/setFactory.js');
const { loginRateLimit, registerRateLimit, syncRateLimit } =
  await import('../src/middleware/rateLimit.js');
let redis: Awaited<ReturnType<typeof connectTestRedis>> | undefined;

beforeAll(async () => {
  await sequelize.authenticate();
  if (redisRequired) redis = await connectTestRedis();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await assertSafeTestDatabase(sequelize);
  const users = await sequelize.query<{ id: number }>('SELECT id FROM public.users', {
    type: QueryTypes.SELECT,
  });
  for (const { id } of users) syncRateLimit.resetKey(String(id));
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    const key = ipKeyGenerator(ip, 56);
    loginRateLimit.resetKey(key);
    registerRateLimit.resetKey(key);
  }
  await cleanTestDatabase();
  resetUserSequence();
  resetCatalogSequence();
  if (redis) await cleanTestRedis(redis);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('External HTTP is disabled in integration tests');
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  try {
    if (redis) {
      try {
        await cleanTestRedis(redis);
      } finally {
        closeTestRedis(redis);
      }
    }
  } finally {
    try {
      await cleanTestDatabase();
    } finally {
      await sequelize.close();
    }
  }
});
