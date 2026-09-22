import Set from '../models/SetModel.js';
import Card from '../models/CardModel.js';

export const getAllSets = async () => {
  return Set.findAll({
    order: [['releaseDate', 'DESC']],
  });
};

export const getSetById = async (id: number) => {
  return Set.findByPk(id, {
    include: [
      {
        model: Card,
        as: 'cards',
        attributes: ['id', 'name', 'number', 'rarity', 'imageUrl'],
      },
    ],
  });
};
