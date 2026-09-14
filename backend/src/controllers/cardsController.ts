import { Request, Response } from 'express';
import { syncCard, syncSetCards } from '../services/cardSyncService.js'

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

export const syncCardsFromSet = async (
  req: Request,
  res: Response,
) => {
  try {
    const result = await syncSetCards(
      String(req.params.id),
    )

    res.status(201).json(result)
  } catch (error) {
    console.error(error)

    res.status(502).json({
      error: 'Error syncing cards with TCGdex',
    })
  }
}
