import { Set } from '../../src/models/indexModel.js';

let sequence = 0;

export const resetCatalogSequence = () => {
  sequence = 0;
};

export const nextCatalogId = () => ++sequence;

interface SetOptions {
  tcgdexId?: string;
  name?: string;
  series?: string | null;
  releaseDate?: string | null;
  totalCards?: number | null;
  logoUrl?: string | null;
  symbolUrl?: string | null;
}

export const createSet = (options: SetOptions = {}) =>
  Set.create({
    tcgdexId: `test-set-${nextCatalogId()}`,
    name: 'Base Set',
    series: 'Base',
    releaseDate: '1999-01-09',
    totalCards: 102,
    ...options,
  });
