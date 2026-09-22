import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Card extends Model {
  declare id: number;
  declare tcgdexId: string;
  declare setId: number;
  declare name: string;
  declare number: string | null;
  declare rarity: string | null;
  declare imageUrl: string | null;
  declare category: string | null;
  declare hp: number | null;
  declare artist: string | null;
  declare description: string | null;
  declare types: string[] | null;
  declare createdAt: Date;
  declare updatedAt: Date | null;
}

Card.init(
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
    setId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'set_id',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    rarity: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'image_url',
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    hp: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    artist: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    types: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'cards',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Card;
