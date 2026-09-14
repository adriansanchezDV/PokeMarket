import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class User extends Model {
  declare id: number;
  declare fullName: string | null;
  declare email: string;
  declare password: string;
  declare createdAt: Date;
  declare updatedAt: Date | null;
  declare role: 'customer' | 'seller' | 'admin';
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    fullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'full_name',
    },

    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('customer', 'seller', 'admin'),
      allowNull: false,
      defaultValue: 'customer',
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default User;
