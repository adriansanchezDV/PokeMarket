import { Request, Response } from 'express';
import { getSets, getSet } from '../services/tcgdexService.js';
import { syncSet } from '../services/setSyncService.js';

export const getAllSets = async (_req: Request, res: Response) => {
  try {
    const sets = await getSets();

    res.json(sets);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: 'Error communicating with TCGdex',
    });
  }
};

export const getSingleSet = async (req: Request, res: Response) => {
  try {
    const set = await getSet(String(req.params.id));

    res.json(set);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: 'Error communicating with TCGdex',
    });
  }
};

export const syncSingleSet = async (req: Request, res: Response) => {
  try {
    const set = await syncSet(String(req.params.id));

    res.status(201).json(set);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: 'Error syncing set with TCGdex',
    });
  }
};
