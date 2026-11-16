import { useParams } from 'react-router';

import { useGetCardByIdQuery } from '../api/cardsApi';

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>();

  const cardId = Number(id);
  const isValidId = Number.isInteger(cardId) && cardId > 0;

  const {
    data: card,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCardByIdQuery(cardId, {
    skip: !isValidId,
  });

  if (!isValidId) {
    return <p>El identificador de la carta no es válido.</p>;
  }

  if (isLoading) {
    return <p>Cargando carta Pokémon...</p>;
  }

  if (isError) {
    const notFound = error && 'status' in error && error.status === 404;

    return (
      <div>
        <p>{notFound ? 'No se ha encontrado la carta.' : 'No se ha podido cargar la carta.'}</p>

        {!notFound && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-lg border px-4 py-2"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (!card) {
    return <p>No se ha encontrado la carta.</p>;
  }

  return (
    <section className="mx-auto max-w-6xl p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={`Carta ${card.name}`}
              className="mx-auto max-h-[500px] w-full object-contain"
            />
          ) : (
            <p>Imagen no disponible.</p>
          )}
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{card.name}</h1>

          <p>Expansión: {card.set.name}</p>
          <p>Número: {card.number}</p>
          <p>Rareza: {card.rarity ?? 'Sin datos'}</p>
          <p>Categoría: {card.category ?? 'Sin datos'}</p>
          <p>HP: {card.hp ?? 'No aplica'}</p>
          <p>Tipo: {card.types.join(', ') || 'Sin datos'}</p>
          <p>Ilustrador: {card.artist ?? 'Sin datos'}</p>

          {card.description && <p>{card.description}</p>}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-5 text-2xl font-bold">Productos disponibles</h2>

        {card.products.length === 0 ? (
          <p>Actualmente no hay vendedores ofreciendo esta carta.</p>
        ) : (
          <div className="space-y-4">
            {card.products.map((product) => (
              <article key={product.id} className="rounded-xl border p-5">
                <h3 className="font-semibold">{product.seller.storeName}</h3>

                <p>Estado: {product.condition}</p>
                <p>Idioma: {product.language}</p>
                <p>Stock: {product.stock}</p>

                <p className="mt-2 text-lg font-bold">{product.price} €</p>

                {product.description && (
                  <p className="mt-2 text-sm text-gray-600">{product.description}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
