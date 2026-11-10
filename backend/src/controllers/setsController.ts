import { Request, Response } from 'express';
import { getAllSets as findAllSets, getSetById } from '../services/setsService.js';
import { syncSet } from '../services/sync/setSyncService.js';
import {
  getSetsListCache,
  setSetsListCache,
  getSetDetailCache,
  setSetDetailCache,
} from '../services/cache/setsCacheService.js';

export const getAllSets = async (_req: Request, res: Response) => {
  try {
    const cachedSets = await getSetsListCache<Awaited<ReturnType<typeof findAllSets>>>();

    if (cachedSets !== null) {
      console.log('[GET /sets] Redis cache HIT');
      res.json(cachedSets);
      return;
    }

    console.log('[GET /sets] Redis cache MISS');

    console.time('[GET /sets] Consulta PostgreSQL');

    const sets = await findAllSets();

    console.timeEnd('[GET /sets] Consulta PostgreSQL');

    await setSetsListCache(sets);

    console.log(`[GET /sets] Sets encontrados: ${sets.length}`);

    res.json(sets);
  } catch (error) {
    console.error('[GET /sets] Error:', error);

    res.status(500).json({
      error: 'Error retrieving sets',
    });
  }
};

export const getSingleSet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: 'Invalid set id',
      });
      return;
    }

    const cachedSet =
      await getSetDetailCache<NonNullable<Awaited<ReturnType<typeof getSetById>>>>(id);

    if (cachedSet !== null) {
      console.log(`[GET /sets/${id}] Redis cache HIT`);
      res.json(cachedSet);
      return;
    }

    console.log(`[GET /sets/${id}] Redis cache MISS`);

    const set = await getSetById(id);

    if (!set) {
      res.status(404).json({
        error: 'Set not found',
      });
      return;
    }

    await setSetDetailCache(id, set);

    res.json(set);
  } catch (error) {
    console.error('[GET /sets/:id] Error:', error);

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
    console.error('[POST /sets/:id/sync] Error:', error);

    res.status(502).json({
      error: 'Error syncing set with TCGdex or invalidating its cache',
    });
  }
};
