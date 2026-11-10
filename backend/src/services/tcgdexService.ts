import type { TcgdexCard, TcgdexSet } from '../types/tcgdex.js';

const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/en';
const TCGDEX_TIMEOUT_MS = 10_000;

const getTcgdexResource = async <T>(path: string): Promise<T> => {
  const signal = AbortSignal.timeout(TCGDEX_TIMEOUT_MS);

  try {
    const response = await fetch(TCGDEX_BASE_URL + path, { signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('TCGdex error: ' + response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (signal.aborted) {
      throw new Error('TCGdex request timed out', { cause: error });
    }
    if (error instanceof TypeError) {
      throw new Error('Unable to connect to TCGdex', { cause: error });
    }
    if (error instanceof SyntaxError) {
      throw new Error('Invalid response from TCGdex', { cause: error });
    }
    throw error;
  }
};

export const getSets = (): Promise<TcgdexSet[]> => getTcgdexResource('/sets');

export const getSet = (id: string): Promise<TcgdexSet> =>
  getTcgdexResource('/sets/' + encodeURIComponent(id));

export const getCard = (id: string): Promise<TcgdexCard> =>
  getTcgdexResource('/cards/' + encodeURIComponent(id));
