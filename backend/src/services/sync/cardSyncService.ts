import sequelize from '../../config/database.js';
import Card from '../../models/CardModel.js';
import Set from '../../models/SetModel.js';
import { getCard, getSet } from '../tcgdexService.js';
import { mapTcgdexCard } from '../../mappers/tcgdexMapper.js';
import { invalidateCardsCache } from '../cache/cardsCacheService.js';
import { invalidateSetDetailCache } from '../cache/setsCacheService.js';

const getCardData = async (tcgdexId: string) => {
  const tcgdexCard = await getCard(tcgdexId);

  const set = await Set.findOne({
    where: {
      tcgdexId: tcgdexCard.set.id,
    },
  });

  if (!set) {
    throw new Error(`Set ${tcgdexCard.set.id} not found in database`);
  }

  return mapTcgdexCard(tcgdexCard, set.id);
};

export const syncCard = async (tcgdexId: string, shouldInvalidateCache = true) => {
  const cardData = await getCardData(tcgdexId);

  const [card] = await Card.upsert(cardData, {
    returning: true,
  });

  if (shouldInvalidateCache) {
    await invalidateCardsCache(card.id);
    await invalidateSetDetailCache(cardData.setId);
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

  const pendingCards: Awaited<ReturnType<typeof getCardData>>[] = [];
  for (const card of tcgdexSet.cards) {
    pendingCards.push(await getCardData(card.id));
  }

  const syncedCards = await sequelize.transaction(async (transaction) => {
    const cards: Card[] = [];
    for (const cardData of pendingCards) {
      const [card] = await Card.upsert(cardData, { returning: true, transaction });
      cards.push(card);
    }
    return cards;
  });

  if (syncedCards.length > 0) {
    await invalidateCardsCache(syncedCards.map((card) => card.id));
    await invalidateSetDetailCache([...new globalThis.Set(pendingCards.map((card) => card.setId))]);
  }

  return {
    set: set.name,
    total: syncedCards.length,
    cards: syncedCards,
  };
};
