import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Set extends Model {
  declare id: number;
  declare tcgdexId: string;
  declare name: string;
  declare series: string | null;
  declare releaseDate: Date | null;
  declare totalCards: number | null;
  declare logoUrl: string | null;
  declare symbolUrl: string | null;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

Set.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tcgdexId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'tcgdex_id',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    series: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'release_date',
    },
    totalCards: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'total_cards',
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'logo_url',
    },
    symbolUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'symbol_url',
    },
  },
  {
    sequelize,
    tableName: 'sets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Set;
