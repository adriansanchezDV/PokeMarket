import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/env.js';
import sequelize from '../../helpers/testDatabase.js';
import redis from '../../../src/config/redis.js';
import { classifyTestFile } from '../../helpers/testEnvironment.js';

describe('Testing infrastructure with real Redis', () => {
  it('initializes Sequelize and Redis only after selecting the testing environment', async () => {
    expect(classifyTestFile(expect.getState().testPath)).toEqual({
      redisRequired: true,
    });
    expect(process.env.NODE_ENV).toBe('test');
    expect(sequelize.getDatabaseName()).toBe('pokemarket_test');
    const [row] = await sequelize.query<{ database: string }>(
      'SELECT current_database() AS database',
      { type: QueryTypes.SELECT },
    );
    expect(row.database).toBe('pokemarket_test');
    // Boolean comparisons avoid printing credentials or authenticated URLs on failure.
    expect(config.DB_USER === process.env.DB_USER).toBe(true);
    expect(config.DB_PASSWORD === process.env.DB_PASSWORD).toBe(true);
    expect(config.JWT_SECRET === process.env.JWT_SECRET).toBe(true);
    expect(config.REDIS_URL === process.env.TEST_REDIS_URL).toBe(true);
    expect(redis.options?.url === process.env.TEST_REDIS_URL).toBe(true);
    expect(redis.isReady).toBe(true);
    expect(await redis.ping()).toBe('PONG');
  });

  it('writes, reads and deletes only an exclusive testing key', async () => {
    const key = 'pokemarket:test:infrastructure:' + randomUUID();
    try {
      expect(await redis.set(key, 'test-only', { EX: 30, NX: true })).toBe('OK');
      expect(await redis.get(key)).toBe('test-only');
      expect(await redis.del(key)).toBe(1);
      expect(await redis.exists(key)).toBe(0);
    } finally {
      await redis.del(key);
    }
  });
});
