import type { Request, Response } from 'express';
import {
  getAdminDashboardStats,
  getAdminUserDetails,
  getAdminUsers,
  updateAdminSellerStatus,
  updateAdminUserBanStatus,
} from '../services/adminService.js';

export const getAdminAccess = (_req: Request, res: Response) => {
  res.json({
    message: 'Admin access granted',
  });
};

export const getDashboard = async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminDashboardStats();

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);

    res.status(500).json({
      message: 'Error fetching admin dashboard',
    });
  }
};

const VALID_ROLES = ['customer', 'seller', 'admin'] as const;

export const listAdminUsers = async (req: Request, res: Response) => {
  const pageParam = req.query.page;
  const limitParam = req.query.limit;
  const searchParam = req.query.search;
  const roleParam = req.query.role;

  const page = pageParam === undefined ? 1 : Number(pageParam);
  const limit = limitParam === undefined ? 10 : Number(limitParam);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    res.status(400).json({
      message: 'page must be positive and limit must be between 1 and 100',
    });
    return;
  }

  if (searchParam !== undefined && typeof searchParam !== 'string') {
    res.status(400).json({
      message: 'search must be a string',
    });
    return;
  }

  if (
    roleParam !== undefined &&
    (typeof roleParam !== 'string' ||
      !VALID_ROLES.includes(roleParam as (typeof VALID_ROLES)[number]))
  ) {
    res.status(400).json({
      message: 'Invalid role. Use customer, seller or admin',
    });
    return;
  }

  try {
    const result = await getAdminUsers({
      page,
      limit,
      search: searchParam as string | undefined,
      role: roleParam as (typeof VALID_ROLES)[number] | undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing admin users:', error);

    res.status(500).json({
      message: 'Error fetching users',
    });
  }
};

export const getAdminUserDetailsController = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({
      message: 'Invalid user ID',
    });
    return;
  }

  try {
    const user = await getAdminUserDetails(userId);

    if (!user) {
      res.status(404).json({
        message: 'User not found',
      });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching admin user details:', error);

    res.status(500).json({
      message: 'Error fetching user details',
    });
  }
};

export const updateAdminSellerStatusController = async (req: Request, res: Response) => {
  const sellerProfileId = Number(req.params.id);
  const { isActive } = req.body ?? {};

  if (!Number.isInteger(sellerProfileId) || sellerProfileId < 1) {
    res.status(400).json({
      message: 'Invalid seller profile ID',
    });
    return;
  }

  if (typeof isActive !== 'boolean') {
    res.status(400).json({
      message: 'isActive must be a boolean',
    });
    return;
  }

  try {
    const result = await updateAdminSellerStatus(sellerProfileId, isActive);

    if (!result) {
      res.status(404).json({
        message: 'Seller profile not found',
      });
      return;
    }

    res.json({
      message: result.changed
        ? `Seller store ${isActive ? 'activated' : 'deactivated'} successfully`
        : 'Seller store already has this status',
      sellerProfile: {
        id: result.sellerProfile.id,
        userId: result.sellerProfile.userId,
        storeName: result.sellerProfile.storeName,
        isActive: result.sellerProfile.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating seller status:', error);

    res.status(500).json({
      message: 'Error updating seller status',
    });
  }
};

export const updateAdminUserBanStatusController = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { isBanned } = req.body ?? {};

  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  if (typeof isBanned !== 'boolean') {
    res.status(400).json({
      message: 'isBanned must be a boolean',
    });
    return;
  }

  try {
    const result = await updateAdminUserBanStatus(userId, isBanned);

    if (!result) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if ('forbidden' in result) {
      res.status(403).json({
        message: 'Administrators cannot be banned through this endpoint',
      });
      return;
    }

    res.json({
      message: result.changed
        ? `User ${isBanned ? 'banned' : 'unbanned'} successfully`
        : 'User already has this status',
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
        isBanned: result.user.isBanned,
      },
    });
  } catch (error) {
    console.error('Error updating user ban status:', error);
    res.status(500).json({
      message: 'Error updating user status',
    });
  }
};
