import { getSet } from '../tcgdexService.js';
import Set from '../../models/SetModel.js';
import { mapTcgdexSet } from '../../mappers/tcgdexMapper.js';

export const syncSet = async (tcgdexId: string) => {
  const tcgdexSet = await getSet(tcgdexId);

  const setData = mapTcgdexSet(tcgdexSet);

  const [set] = await Set.upsert(setData, {
    returning: true,
  });

  return set;
};
