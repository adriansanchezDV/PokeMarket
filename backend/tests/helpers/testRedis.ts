import type { RedisClientType } from 'redis';
import { assertTestEnvironment, getConfiguredTestRedisUrl } from './testEnvironment.js';

export const connectTestRedis = async () => {
  assertTestEnvironment();
  const testUrl = getConfiguredTestRedisUrl();
  if (process.env.REDIS_URL !== testUrl) {
    throw new Error(
      'Redis integration must explicitly select TEST_REDIS_URL before importing the app',
    );
  }
  const { default: config } = await import('../../src/config/env.js');
  if (config.REDIS_URL !== process.env.TEST_REDIS_URL) {
    throw new Error('The application Redis client was initialized for a different destination');
  }
  const { default: client } = await import('../../src/config/redis.js');
  if (client.options?.url !== process.env.TEST_REDIS_URL) {
    throw new Error('The Redis client does not target the explicitly configured test destination');
  }
  if (!client.isReady) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.connect(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Test Redis connection timed out')), 5000);
        }),
      ]);
      await client.ping();
    } catch {
      if (client.isOpen) client.destroy();
      throw new Error('Unable to connect to the isolated test Redis');
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  return client;
};

export const cleanTestRedis = async (client: RedisClientType) => {
  assertTestEnvironment();
  const testUrl = getConfiguredTestRedisUrl();
  if (process.env.REDIS_URL !== testUrl || client.options?.url !== testUrl) {
    throw new Error('Refusing Redis cleanup without an explicit test destination');
  }
  if (!client.isReady) throw new Error('Test Redis is unavailable during cleanup');
  for (const pattern of ['cards:list:*', 'cards:detail:*', 'sets:list', 'sets:detail:*']) {
    for await (const keys of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      if (keys.length > 0) await client.del(keys);
    }
  }
};

export const closeTestRedis = (client: RedisClientType) => {
  if (client.isOpen) client.destroy();
};
