import { col, Op } from 'sequelize';

import sequelize from '../config/database.js';
import ShippingAddress from '../models/ShippingAdressModel.js';


type ShippingAddressData = {
  recipientName: string;
  street: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  phone: string;
  isDefault?: boolean;
};

export const getUserShippingAddresses = async (userId: number) => {
  return ShippingAddress.findAll({
    where: { userId },
    order: [
      [col('is_default'), 'DESC'],
      [col('created_at'), 'DESC'],
    ],
  });
};

export const getShippingAddressById = async (
  userId: number,
  addressId: number,
) => {
  return ShippingAddress.findOne({
    where: {
      id: addressId,
      userId,
    },
  });
};

export const createShippingAddress = async (
  userId: number,
  data: ShippingAddressData,
) => {
  return sequelize.transaction(async (transaction) => {
    const shouldBeDefault =
      data.isDefault === true ||
      (await ShippingAddress.count({
        where: { userId },
        transaction,
      })) === 0;

    if (shouldBeDefault) {
      await ShippingAddress.update(
        { isDefault: false },
        {
          where: { userId },
          transaction,
        },
      );
    }

    return ShippingAddress.create(
      {
        userId,
        recipientName: data.recipientName,
        street: data.street,
        city: data.city,
        postalCode: data.postalCode,
        province: data.province,
        country: data.country,
        phone: data.phone,
        isDefault: shouldBeDefault,
      },
      { transaction },
    );
  });
};

export const updateShippingAddress = async (
  userId: number,
  addressId: number,
  data: Partial<ShippingAddressData>,
) => {
  return sequelize.transaction(async (transaction) => {
    const address = await ShippingAddress.findOne({
      where: {
        id: addressId,
        userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!address) {
      throw new Error('Shipping address not found');
    }

    if (data.isDefault === true) {
      await ShippingAddress.update(
        { isDefault: false },
        {
          where: {
            userId,
            id: {
              [Op.ne]: addressId,
            },
          },
          transaction,
        },
      );
    }

    await address.update(data, { transaction });

    return address;
  });
};

export const deleteShippingAddress = async (
  userId: number,
  addressId: number,
) => {
  return sequelize.transaction(async (transaction) => {
    const address = await ShippingAddress.findOne({
      where: {
        id: addressId,
        userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!address) {
      throw new Error('Shipping address not found');
    }

    const wasDefault = address.isDefault;

    await address.destroy({ transaction });

    if (wasDefault) {
      const nextAddress = await ShippingAddress.findOne({
  where: { userId },
  order: [[col('created_at'), 'ASC']],
  transaction,
  lock: transaction.LOCK.UPDATE,
});

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save({ transaction });
      }
    }

    return address;
  });
};

export const setDefaultShippingAddress = async (
  userId: number,
  addressId: number,
) => {
  return sequelize.transaction(async (transaction) => {
    const address = await ShippingAddress.findOne({
      where: {
        id: addressId,
        userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!address) {
      throw new Error('Shipping address not found');
    }

    await ShippingAddress.update(
      { isDefault: false },
      {
        where: {
          userId,
          id: {
            [Op.ne]: addressId,
          },
        },
        transaction,
      },
    );

    address.isDefault = true;

    await address.save({ transaction });

    return address;
  });
};