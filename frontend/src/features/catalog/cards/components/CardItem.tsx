import { Link } from 'react-router';

import type { PokemonCard } from '../types/card.types';

interface CardItemProps {
  card: PokemonCard;
}

export function CardItem({ card }: CardItemProps) {
  return (
    <Link
      to={`/cards/${card.id}`}
      className="flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-lg"
    >
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={`Carta ${card.name}`}
          className="h-64 w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex h-64 items-center justify-center bg-gray-100 text-sm text-gray-500">
          Imagen no disponible
        </div>
      )}

      <h2 className="font-semibold">{card.name}</h2>

      <p className="text-sm text-gray-500">Nº {card.number}</p>

      {card.rarity && <p className="text-sm">Rareza: {card.rarity}</p>}

      {card.hp !== null && <p className="text-sm">HP: {card.hp}</p>}
    </Link>
  );
}
