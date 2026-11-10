import { createClient } from 'redis';
import config from './env.js';

const redisClient = createClient({
  url: config.REDIS_URL,
  disableOfflineQueue: true,
  socket: { connectTimeout: 2000 },
  commandOptions: { timeout: 1000 },
});

redisClient.on('error', (error) => {
  console.error('Redis client error:', error instanceof Error ? error.name : 'UnknownError');
});

export default redisClient;
