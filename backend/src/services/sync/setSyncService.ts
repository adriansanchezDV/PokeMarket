import { invalidateSetsCache } from '../cache/setsCacheService.js';
import { invalidateSetCardDetails } from '../cache/cardsCacheService.js';
import { getSet } from '../tcgdexService.js';
import Set from '../../models/SetModel.js';
import { mapTcgdexSet } from '../../mappers/tcgdexMapper.js';

export const syncSet = async (tcgdexId: string) => {
  const tcgdexSet = await getSet(tcgdexId);

  const setData = mapTcgdexSet(tcgdexSet);

  const [set] = await Set.upsert(setData, {
    returning: true,
  });

  await invalidateSetsCache(set.id);
  await invalidateSetCardDetails(set.id);

  return set;
};
