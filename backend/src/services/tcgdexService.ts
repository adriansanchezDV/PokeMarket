import type { TcgdexCard, TcgdexSet } from '../types/tcgdex.js';

const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/en';

export const getSets = async (): Promise<TcgdexSet[]> => {
  const response = await fetch(`${TCGDEX_BASE_URL}/sets`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json() as Promise<TcgdexSet[]>;
};

export const getSet = async (id: string): Promise<TcgdexSet> => {
  const response = await fetch(`${TCGDEX_BASE_URL}/sets/${id}`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json() as Promise<TcgdexSet>;
};

export const getCard = async (id: string): Promise<TcgdexCard> => {
  const response = await fetch(`${TCGDEX_BASE_URL}/cards/${id}`);

  if (!response.ok) {
    throw new Error(`TCGdex error: ${response.status}`);
  }

  return response.json() as Promise<TcgdexCard>;
};
