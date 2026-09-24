import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class OrderItem extends Model {
  declare id: number;
  declare orderId: number;
  declare productId: number | null;
  declare sellerProfileId: number | null;
  declare unitPrice: string;
  declare quantity: number;
  declare productName: string;
  declare sellerName: string;
  declare condition: string;
  declare language: string;
  declare status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'order_id',
    },

    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'product_id',
    },

    sellerProfileId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'seller_profile_id',
    },

    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unit_price',
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    productName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: '',
      field: 'product_name',
    },

    sellerName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
      field: 'seller_name',
    },

    condition: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '',
    },

    language: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '',
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'pending',
    },
  },

  {
    sequelize,
    tableName: 'order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrderItem;
