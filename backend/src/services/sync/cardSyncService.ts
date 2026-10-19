import Card from '../../models/CardModel.js';
import Set from '../../models/SetModel.js';
import { getCard, getSet } from '../tcgdexService.js';
import { mapTcgdexCard } from '../../mappers/tcgdexMapper.js';
import { invalidateCardsCache } from '../cache/cardsCacheService.js';

export const syncCard = async (tcgdexId: string,
  shouldInvalidateCache = true,) => {
  const tcgdexCard = await getCard(tcgdexId);

  const set = await Set.findOne({
    where: {
      tcgdexId: tcgdexCard.set.id,
    },
  });

  if (!set) {
    throw new Error(`Set ${tcgdexCard.set.id} not found in database`);
  }

  const cardData = mapTcgdexCard(tcgdexCard, set.id);

  const [card] = await Card.upsert(cardData, {
  returning: true,
});

if (shouldInvalidateCache) {
  await invalidateCardsCache(card.id);
}

return card;
};

export const syncSetCards = async (tcgdexSetId: string) => {
  const tcgdexSet = await getSet(tcgdexSetId);

  const set = await Set.findOne({
    where: {
      tcgdexId: tcgdexSetId,
    },
  });

  if (!set) {
    throw new Error(`Set ${tcgdexSetId} not found in database`);
  }

  if (!tcgdexSet.cards) {
    throw new Error(`Set ${tcgdexSetId} has no cards`);
  }

  const syncedCards = [];

  for (const card of tcgdexSet.cards) {
    const syncedCard = await syncCard(card.id, false);

    syncedCards.push(syncedCard);
  }

  await invalidateCardsCache();

  return {
    set: set.name,
    total: syncedCards.length,
    cards: syncedCards,
  };
};
