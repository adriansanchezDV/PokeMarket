
import { createHash } from 'node:crypto';
import redisClient from '../../config/redis.js';

const CACHE_TTL_SECONDS = 300;

const CARD_LIST_PREFIX = 'cards:list:';
const CARD_DETAIL_PREFIX = 'cards:detail:';

type CardListCacheParams = {
  filters: Record<string, unknown>;
  page: number;
  limit: number;
};

const createCardListKey = ({
  filters,
  page,
  limit,
}: CardListCacheParams): string => {
  const cacheParams = JSON.stringify({
    filters,
    page,
    limit,
  });

  const hash = createHash('sha256')
    .update(cacheParams)
    .digest('hex');

  return `${CARD_LIST_PREFIX}${hash}`;
};

const getCachedValue = async <T>(
  key: string,
): Promise<T | null> => {
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
    console.error('Error reading cards cache:', error);
    return null;
  }
};

const setCachedValue = async (
  key: string,
  value: unknown,
): Promise<void> => {
  try {
    await redisClient.set(key, JSON.stringify(value), {
      EX: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Error writing cards cache:', error);
  }
};

export const getCachedCardList = async <T>(
  params: CardListCacheParams,
): Promise<T | null> => {
  return getCachedValue<T>(createCardListKey(params));
};

export const setCachedCardList = async (
  params: CardListCacheParams,
  cards: unknown,
): Promise<void> => {
  await setCachedValue(createCardListKey(params), cards);
};

export const getCachedCardDetail = async <T>(
  id: number,
): Promise<T | null> => {
  return getCachedValue<T>(`${CARD_DETAIL_PREFIX}${id}`);
};

export const setCachedCardDetail = async (
  id: number,
  card: unknown,
): Promise<void> => {
  await setCachedValue(`${CARD_DETAIL_PREFIX}${id}`, card);
};

const deleteKeysByPattern = async (
  pattern: string,
): Promise<void> => {
  const keysToDelete: string[] = [];

  for await (const keys of redisClient.scanIterator({
    MATCH: pattern,
    COUNT: 100,
  })) {
    keysToDelete.push(...keys);
  }

  if (keysToDelete.length > 0) {
    await redisClient.del(keysToDelete);
  }
};

export const invalidateCardsCache = async (
  cardId?: number,
): Promise<void> => {
  try {
    // Cualquier sincronización puede cambiar los resultados de los listados.
    await deleteKeysByPattern(`${CARD_LIST_PREFIX}*`);

    if (cardId !== undefined) {
      // Si conocemos la carta, basta con borrar su detalle.
      await redisClient.del(`${CARD_DETAIL_PREFIX}${cardId}`);
    } else {
      // Una sincronización de expansión puede afectar a muchas cartas.
      await deleteKeysByPattern(`${CARD_DETAIL_PREFIX}*`);
    }

    console.log('Cards cache invalidated');
  } catch (error) {
    console.error('Error invalidating cards cache:', error);
  }
};



export const invalidateCardDetailCache = async (
  cardId: number,
): Promise<void> => {
  try {
    await redisClient.del(`${CARD_DETAIL_PREFIX}${cardId}`);
    console.log(`[Redis] Card detail cache invalidated: ${cardId}`);
  } catch (error) {
    console.error('Error invalidating card detail cache:', error);
  }
};
