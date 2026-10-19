
import redisClient from '../../config/redis.js';

const CACHE_TTL_SECONDS = 300;

const SETS_LIST_KEY = 'sets:list';
const SETS_DETAIL_PREFIX = 'sets:detail:';

export const getCachedValue = async <T>(
  key: string,
): Promise<T | null> => {
  const cachedValue = await redisClient.get(key);

  if (cachedValue === null) {
    return null;
  }

  try {
    return JSON.parse(cachedValue) as T;
  } catch {
    await redisClient.del(key);
    return null;
  }
};

export const setCachedValue = async (
  key: string,
  value: unknown,
): Promise<void> => {
  await redisClient.set(key, JSON.stringify(value), {
    EX: CACHE_TTL_SECONDS,
  });
};

export const getSetsListCache = async <T>() => {
  return getCachedValue<T>(SETS_LIST_KEY);
};

export const setSetsListCache = async (
  sets: unknown,
): Promise<void> => {
  await setCachedValue(SETS_LIST_KEY, sets);
};

export const getSetDetailCache = async <T>(id: number) => {
  return getCachedValue<T>(`${SETS_DETAIL_PREFIX}${id}`);
};

export const setSetDetailCache = async (
  id: number,
  set: unknown,
): Promise<void> => {
  await setCachedValue(`${SETS_DETAIL_PREFIX}${id}`, set);
};


export const invalidateSetsCache = async (): Promise<void> => {
  await redisClient.del(SETS_LIST_KEY);

  const detailKeys: string[] = [];

  for await (const keys of redisClient.scanIterator({
    MATCH: `${SETS_DETAIL_PREFIX}*`,
    COUNT: 100,
  })) {
    detailKeys.push(...keys);
  }

  if (detailKeys.length > 0) {
    await redisClient.del(detailKeys);
  }
};

