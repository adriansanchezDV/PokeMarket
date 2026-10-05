import type { Request, Response, NextFunction } from 'express';

import {
  createSellerProfile as createSellerProfileService,
  getSellerProfile as getSellerProfileService,
  updateSellerProfile as updateSellerProfileService,
} from '../services/sellerProfileService.js';

import { generateAuthToken } from '../services/authService.js';

export const createSellerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeName, description } = req.body;

    const { user, profile } = await createSellerProfileService(
      req.user!.id,
      storeName,
      description,
    );

    const token = generateAuthToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      store: {
        id: profile.id,
        userId: profile.userId,
        storeName: profile.storeName,
        description: profile.description,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
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

    const profile = await getSellerProfileService(id);

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
    const { storeName, description } = req.body;

    const profile = await updateSellerProfileService(req.user!.id, storeName, description);

    res.json({
      id: profile.id,
      userId: profile.userId,
      storeName: profile.storeName,
      description: profile.description,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};
