
import { createClient } from 'redis';
import config from './env.js';

const redisClient = createClient({
  url: config.REDIS_URL,
});

redisClient.on('error', (error) => {
  console.error('Redis client error:', error);
});

export default redisClient;
