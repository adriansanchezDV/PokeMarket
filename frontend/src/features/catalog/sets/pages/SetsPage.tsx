import { Link } from 'react-router';
import { useGetSetsQuery } from '../api/setsApi';

export function SetsPage() {
  const { data: sets, isLoading, isError, refetch } = useGetSetsQuery();

  if (isLoading) {
    return <p>Cargando expansiones...</p>;
  }

  if (isError) {
    return (
      <div>
        <p>No se han podido cargar las expansiones.</p>
        <button type="button" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!sets || sets.length === 0) {
    return <p>No hay expansiones disponibles.</p>;
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">Expansiones Pokémon</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <Link
            key={set.id}
            to={`/cards?setId=${set.id}`}
            className="flex flex-col items-center gap-4 rounded-xl border p-6 transition-shadow hover:shadow-lg"
          >
            {set.logoUrl && (
              <img
                src={set.logoUrl}
                alt={`Logo de ${set.name}`}
                className="h-24 w-full object-contain"
                loading="lazy"
              />
            )}

            <h2 className="text-lg font-semibold">{set.name}</h2>

            <p className="text-sm text-gray-500">{set.series}</p>

            <p className="text-sm">
              {set.totalCards === null
                ? 'Número de cartas desconocido'
                : `${set.totalCards} cartas`}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
