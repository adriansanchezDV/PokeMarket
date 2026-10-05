import type { RequestHandler } from 'express';

import {
  createShippingAddress,
  deleteShippingAddress,
  getShippingAddressById,
  getUserShippingAddresses,
  setDefaultShippingAddress,
  updateShippingAddress,
} from '../services/shippingAddressService.js';

export const getShippingAddresses: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const addresses = await getUserShippingAddresses(req.user!.id);

    return res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
};

export const getShippingAddress: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const addressId = Number(req.params.id);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        error: 'Invalid shipping address id',
      });
    }

    const address = await getShippingAddressById(
      req.user!.id,
      addressId,
    );

    if (!address) {
      return res.status(404).json({
        error: 'Shipping address not found',
      });
    }

    return res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

export const createNewShippingAddress: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const address = await createShippingAddress(
      req.user!.id,
      req.body,
    );

    return res.status(201).json(address);
  } catch (error) {
    next(error);
  }
};

export const updateExistingShippingAddress: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const addressId = Number(req.params.id);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        error: 'Invalid shipping address id',
      });
    }

    const address = await updateShippingAddress(
      req.user!.id,
      addressId,
      req.body,
    );

    return res.status(200).json(address);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Shipping address not found') {
        return res.status(404).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const deleteExistingShippingAddress: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const addressId = Number(req.params.id);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        error: 'Invalid shipping address id',
      });
    }

    const address = await deleteShippingAddress(
      req.user!.id,
      addressId,
    );

    return res.status(200).json({
      message: 'Shipping address deleted',
      address,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Shipping address not found') {
        return res.status(404).json({
          error: error.message,
        });
      }
    }

    next(error);
  }
};

export const setDefaultShippingAddressController: RequestHandler =
  async (req, res, next) => {
    try {
      const addressId = Number(req.params.id);

      if (!Number.isInteger(addressId) || addressId <= 0) {
        return res.status(400).json({
          error: 'Invalid shipping address id',
        });
      }

      const address = await setDefaultShippingAddress(
        req.user!.id,
        addressId,
      );

      return res.status(200).json(address);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Shipping address not found') {
          return res.status(404).json({
            error: error.message,
          });
        }
      }

      next(error);
    }
  };