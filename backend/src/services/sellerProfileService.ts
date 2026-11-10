import type { Transaction } from 'sequelize';
import { invalidateSellerCardDetails } from './cache/cardsCacheService.js';
import { SellerProfile, User } from '../models/indexModel.js';
import sequelize from '../config/database.js';

import { AppError } from '../utils/AppError.js';

export const requireActiveSellerProfile = async (
  sellerProfileId: number | number[],
  transaction: Transaction,
) => {
  const ids = [...new Set(Array.isArray(sellerProfileId) ? sellerProfileId : [sellerProfileId])];
  if (ids.length === 0) {
    return;
  }

  const profiles = await SellerProfile.findAll({
    where: { id: ids },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (profiles.length !== ids.length) {
    throw new AppError(404, 'Seller profile not found');
  }

  if (profiles.some((profile) => !profile.isActive)) {
    throw new AppError(403, 'Seller profile is inactive');
  }
};

export const createSellerProfile = async (
  userId: number,
  storeName: string,
  description?: string,
) => {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const existingProfile = await SellerProfile.findOne({
      where: { userId },
      transaction,
    });

    if (existingProfile) {
      throw new AppError(409, 'Seller profile already exists');
    }

    const existingStoreName = await SellerProfile.findOne({
      where: { storeName },
      transaction,
    });

    if (existingStoreName) {
      throw new AppError(409, 'Store name already registered');
    }

    user.role = 'seller';

    await user.save({
      transaction,
    });

    const profile = await SellerProfile.create(
      {
        userId,
        storeName,
        description: description ?? null,
      },
      {
        transaction,
      },
    );

    return {
      user,
      profile,
    };
  });
};

export const getSellerProfile = async (id: number) => {
  return SellerProfile.findByPk(id, {
    attributes: ['id', 'storeName', 'description', 'isActive', 'createdAt', 'updatedAt'],
    include: [
      {
        association: 'user',
        attributes: ['id', 'fullName'],
      },
    ],
  });
};

export const updateSellerProfile = async (
  userId: number,
  storeName?: string,
  description?: string | null,
) => {
  const profile = await sequelize.transaction(async (transaction) => {
    const profile = await SellerProfile.findOne({
      where: { userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!profile) {
      throw new AppError(404, 'Seller profile not found');
    }

    if (!profile.isActive) {
      throw new AppError(403, 'Seller profile is inactive');
    }

    if (storeName !== undefined && storeName !== profile.storeName) {
      const existingProfile = await SellerProfile.findOne({
        where: { storeName },
        transaction,
      });

      if (existingProfile) {
        throw new AppError(409, 'Store name already registered');
      }

      profile.storeName = storeName;
    }

    if (description !== undefined) {
      profile.description = description;
    }

    await profile.save({ transaction });

    return profile;
  });

  await invalidateSellerCardDetails(profile.id);

  return profile;
};
