import type { TcgdexCard, TcgdexSet } from '../types/tcgdex.js';

export const getAssetUrl = (url?: string) => {
  if (!url) return null;

  return url.endsWith('.webp') ? url : `${url}.webp`;
};

export const getCardImageUrl = (url?: string) => {
  if (!url) return null;

  return url.endsWith('.webp') ? url : `${url}/high.webp`;
};

export const mapTcgdexSet = (set: TcgdexSet) => ({
  tcgdexId: set.id,
  name: set.name,
  series: set.serie?.name ?? null,
  releaseDate: set.releaseDate ?? null,
  totalCards: set.cardCount?.total ?? null,
  logoUrl: getAssetUrl(set.logo),
  symbolUrl: getAssetUrl(set.symbol),
});

export const mapTcgdexCard = (card: TcgdexCard, setId: number) => ({
  tcgdexId: card.id,
  setId,
  name: card.name,
  number: card.localId ?? null,
  rarity: card.rarity ?? null,
  imageUrl: getCardImageUrl(card.image),
  category: card.category ?? null,
  hp: card.hp ?? null,
  artist: card.illustrator ?? null,
  description: card.description ?? null,
  types: card.types ?? null,
});
