import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Product extends Model {
  declare id: number;
  declare sellerProfileId: number;
  declare cardId: number;
  declare condition: string;
  declare language: string;
  declare price: string;
  declare stock: number;
  declare description: string | null;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sellerProfileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'seller_profile_id',
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'card_id',
    },
    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Product;
