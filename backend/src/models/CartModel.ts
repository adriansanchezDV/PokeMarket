import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Cart extends Model {
  declare id: number;
  declare userId: number;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

Cart.init(
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
  },
  {
    sequelize,
    tableName: 'carts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Cart;
