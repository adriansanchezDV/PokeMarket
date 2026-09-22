import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Favorite extends Model {
  declare id: number;
  declare userId: number;
  declare productId: number;
  declare createdAt: Date;
}

Favorite.init(
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
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
  },
  {
    sequelize,
    tableName: 'favorites',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default Favorite;
