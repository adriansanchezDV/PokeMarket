import redisClient from '../../config/redis.js';

const CACHE_TTL_SECONDS = 300;

const SETS_LIST_KEY = 'sets:list';
const SETS_DETAIL_PREFIX = 'sets:detail:';

export const getCachedValue = async <T>(key: string): Promise<T | null> => {
  if (!redisClient.isReady) return null;

  try {
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
  } catch (error) {
    console.error('Error reading sets cache:', error);
    return null;
  }
};

export const setCachedValue = async (key: string, value: unknown): Promise<void> => {
  if (!redisClient.isReady) return;

  try {
    await redisClient.set(key, JSON.stringify(value), {
      EX: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Error writing sets cache:', error);
  }
};

export const getSetsListCache = async <T>() => {
  return getCachedValue<T>(SETS_LIST_KEY);
};

export const setSetsListCache = async (sets: unknown): Promise<void> => {
  await setCachedValue(SETS_LIST_KEY, sets);
};

export const getSetDetailCache = async <T>(id: number) => {
  return getCachedValue<T>(`${SETS_DETAIL_PREFIX}${id}`);
};

export const setSetDetailCache = async (id: number, set: unknown): Promise<void> => {
  await setCachedValue(`${SETS_DETAIL_PREFIX}${id}`, set);
};

export const invalidateSetsCache = async (setId?: number): Promise<void> => {
  if (!redisClient.isReady) return;

  try {
    await redisClient.del(SETS_LIST_KEY);

    if (setId !== undefined) {
      await invalidateSetDetailCache(setId);
      return;
    }

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
  } catch (error) {
    console.error('Error invalidating sets cache:', error);
  }
};

export const invalidateSetDetailCache = async (setId: number | number[]): Promise<void> => {
  if (!redisClient.isReady) return;

  const ids = [...new Set(Array.isArray(setId) ? setId : [setId])];
  if (ids.length === 0) return;

  try {
    await redisClient.del(ids.map((id) => SETS_DETAIL_PREFIX + id));
  } catch (error) {
    console.error('Error invalidating set detail cache:', error);
  }
};
