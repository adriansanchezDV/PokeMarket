import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ShippingAddress extends Model {
  declare id: number;
  declare userId: number;
  declare recipientName: string;
  declare street: string;
  declare city: string;
  declare postalCode: string;
  declare province: string;
  declare country: string;
  declare phone: string;
  declare isDefault: boolean;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

ShippingAddress.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },

    recipientName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'recipient_name',
    },

    street: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'postal_code',
    },

    province: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default',
    },
  },
  {
    sequelize,
    tableName: 'shipping_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ShippingAddress;
