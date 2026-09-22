import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class SellerProfile extends Model {
  declare id: number;
  declare userId: number;
  declare storeName: string;
  declare description: string | null;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

SellerProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },

    storeName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'store_name',
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'seller_profiles',
    timestamps: false,
  },
);

export default SellerProfile;
