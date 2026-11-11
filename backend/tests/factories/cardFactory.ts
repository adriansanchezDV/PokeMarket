import { Card } from '../../src/models/indexModel.js';
import { createSet, nextCatalogId } from './setFactory.js';

interface CardOptions {
  setId?: number;
  tcgdexId?: string;
  name?: string;
  number?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  hp?: number | null;
  artist?: string | null;
  description?: string | null;
  types?: string[] | null;
}

export const createCard = async (options: CardOptions = {}) => {
  const setId = options.setId ?? (await createSet()).id;
  return Card.create({
    tcgdexId: `test-card-${nextCatalogId()}`,
    name: 'Charizard',
    number: '4',
    rarity: 'Rare Holo',
    category: 'Pokemon',
    hp: 120,
    artist: 'Mitsuhiro Arita',
    description: 'A powerful dragon.',
    types: ['Fire'],
    ...options,
    setId,
  });
};
