import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Notification extends Model {
  declare id: number;
  declare userId: number;
  declare senderId: number | null;
  declare type: string;
  declare title: string;
  declare message: string;
  declare isRead: boolean;
  declare createdAt: Date;
  declare updatedAt: Date | null;
  declare productId: number | null;
}

Notification.init(
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

    senderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sender_id',
    },

    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read',
    },

    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'product_id',
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
  },
);

export default Notification;
