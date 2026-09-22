import { Request, Response } from 'express';
import { getAllSets as findAllSets, getSetById } from '../services/setsService.js';
import { syncSet } from '../services/sync/setSyncService.js';

export const getAllSets = async (_req: Request, res: Response) => {
  try {
    const sets = await findAllSets();

    res.json(sets);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error retrieving sets',
    });
  }
};

export const getSingleSet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({
        error: 'Invalid set id',
      });
      return;
    }

    const set = await getSetById(id);

    if (!set) {
      res.status(404).json({
        error: 'Set not found',
      });
      return;
    }

    res.json(set);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error retrieving set',
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
