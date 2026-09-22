import type { Request, Response, NextFunction } from 'express';

import { SellerProfile } from '../models/indexModel.js';

export const createSellerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeName, description } = req.body;

    const existingProfile = await SellerProfile.findOne({
      where: {
        userId: req.user!.id,
      },
    });

    if (existingProfile) {
      return res.status(409).json({
        error: 'Seller profile already exists',
      });
    }

    const profile = await SellerProfile.create({
      userId: req.user!.id,
      storeName,
      description: description ?? null,
    });

    res.status(201).json({
      id: profile.id,
      userId: profile.userId,
      storeName: profile.storeName,
      description: profile.description,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getSellerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid seller profile id',
      });
    }

    const profile = await SellerProfile.findByPk(id, {
      attributes: ['id', 'storeName', 'description', 'createdAt', 'updatedAt'],
      include: [
        {
          association: 'user',
          attributes: ['id', 'fullName'],
        },
      ],
    });

    if (!profile) {
      return res.status(404).json({
        error: 'Seller profile not found',
      });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
};

export const updateSellerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await SellerProfile.findOne({
      where: {
        userId: req.user!.id,
      },
    });

    if (!profile) {
      return res.status(404).json({
        error: 'Seller profile not found',
      });
    }

    const { storeName, description } = req.body;

    if (storeName !== undefined && storeName !== profile.storeName) {
      const existingProfile = await SellerProfile.findOne({
        where: {
          storeName,
        },
      });

      if (existingProfile) {
        return res.status(409).json({
          error: 'Store name already registered',
        });
      }
    }

    if (storeName !== undefined) {
      profile.storeName = storeName;
    }

    if (description !== undefined) {
      profile.description = description;
    }

    await profile.save();

    res.json({
      id: profile.id,
      userId: profile.userId,
      storeName: profile.storeName,
      description: profile.description,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};
