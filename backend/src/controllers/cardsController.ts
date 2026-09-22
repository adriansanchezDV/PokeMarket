import { Request, Response } from 'express';
import { getAllCards, getCardById } from '../services/cardsService.js';
import { syncCard, syncSetCards } from '../services/sync/cardSyncService.js';

export const getCards = async (req: Request, res: Response) => {
  try {
    const { name, setId, rarity, category, page, limit } = req.query;

    const currentPage = typeof page === 'string' ? Number(page) : 1;

    const currentLimit = typeof limit === 'string' ? Number(limit) : 20;

    // Validar page
    if (!Number.isInteger(currentPage) || currentPage < 1) {
      res.status(400).json({
        error: 'Invalid page',
      });
      return;
    }

    // Validar limit
    if (!Number.isInteger(currentLimit) || currentLimit < 1 || currentLimit > 100) {
      res.status(400).json({
        error: 'Invalid limit. Must be between 1 and 100',
      });
      return;
    }

    // Validar setId
    if (
      setId !== undefined &&
      (typeof setId !== 'string' || !Number.isInteger(Number(setId)) || Number(setId) < 1)
    ) {
      res.status(400).json({
        error: 'Invalid setId',
      });
      return;
    }

    const filters = {
      name: typeof name === 'string' ? name : undefined,

      setId: typeof setId === 'string' ? Number(setId) : undefined,

      rarity: typeof rarity === 'string' ? rarity : undefined,

      category: typeof category === 'string' ? category : undefined,
    };

    const cards = await getAllCards(filters, currentPage, currentLimit);

    res.json(cards);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error retrieving cards',
    });
  }
};
export const getSingleCard = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({
        error: 'Invalid card id',
      });
      return;
    }

    const card = await getCardById(id);

    if (!card) {
      res.status(404).json({
        error: 'Card not found',
      });
      return;
    }

    res.json(card);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error retrieving card',
    });
  }
};

export const syncSingleCard = async (req: Request, res: Response) => {
  try {
    const card = await syncCard(String(req.params.id));

    res.status(201).json(card);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: 'Error syncing card with TCGdex',
    });
  }
};

export const syncCardsFromSet = async (req: Request, res: Response) => {
  try {
    const result = await syncSetCards(String(req.params.id));

    res.status(201).json(result);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: 'Error syncing cards with TCGdex',
    });
  }
};
