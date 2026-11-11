import type { TcgdexCard, TcgdexSet } from '../../../src/types/tcgdex.js';

export const tcgdexSet: TcgdexSet = {
  id: 'base1',
  name: 'Base Set',
  serie: { name: 'Base' },
  releaseDate: '1999-01-09',
  cardCount: { total: 102, official: 102 },
  logo: 'https://assets.tcgdex.net/en/base/base1/logo',
  symbol: 'https://assets.tcgdex.net/en/base/base1/symbol.webp',
  cards: [
    { id: 'base1-4', localId: '4', name: 'Charizard' },
    { id: 'base1-2', localId: '2', name: 'Blastoise' },
  ],
};

export const tcgdexCards: TcgdexCard[] = [
  {
    id: 'base1-4',
    localId: '4',
    name: 'Charizard',
    image: 'https://assets.tcgdex.net/en/base/base1/4',
    category: 'Pokemon',
    illustrator: 'Mitsuhiro Arita',
    rarity: 'Rare Holo',
    hp: 120,
    description: 'A powerful dragon.',
    types: ['Fire'],
    set: { id: 'base1', name: 'Base Set' },
  },
  {
    id: 'base1-2',
    localId: '2',
    name: 'Blastoise',
    image: 'https://assets.tcgdex.net/en/base/base1/2/high.webp',
    category: 'Pokemon',
    rarity: 'Rare Holo',
    hp: 100,
    types: ['Water'],
    set: { id: 'base1', name: 'Base Set' },
  },
];
