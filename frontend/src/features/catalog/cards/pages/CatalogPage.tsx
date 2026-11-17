import { useState, type SubmitEventHandler } from 'react';

import { useGetSetsQuery } from '@/features/catalog/sets/api/setsApi';

import { useGetCardsQuery } from '../api/cardsApi';
import { CardItem } from '../components/CardItem';
import { useSearchParams } from 'react-router';

const PAGE_LIMIT = 20;

export function CatalogPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const setIdParam = searchParams.get('setId');

  const setId =
    setIdParam !== null && Number.isInteger(Number(setIdParam)) && Number(setIdParam) > 0
      ? Number(setIdParam)
      : undefined;
  const [page, setPage] = useState(1);

  const { data: sets, isError: isSetsError } = useGetSetsQuery();

  const { data, isLoading, isFetching, isError, refetch } = useGetCardsQuery({
    search,
    setId,
    page,
    limit: PAGE_LIMIT,
  });

  const cards = data?.data ?? [];
  const pagination = data?.pagination;

  const handleSearch: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleSetChange = (value: string) => {
    setPage(1);

    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);

      if (value === '') {
        nextParams.delete('setId');
      } else {
        nextParams.set('setId', value);
      }

      return nextParams;
    });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);

    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      nextParams.delete('setId');
      return nextParams;
    });
  };
  const handlePreviousPage = () => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
  };

  const handleNextPage = () => {
    if (!pagination) return;

    setPage((currentPage) => Math.min(pagination.totalPages, currentPage + 1));
  };

  return (
    <section className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Catálogo de cartas Pokémon</h1>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar cartas Pokémon..."
          aria-label="Buscar cartas Pokémon"
          className="min-w-0 flex-1 rounded-lg border px-4 py-2"
        />

        <select
          value={setId ?? ''}
          onChange={(event) => handleSetChange(event.target.value)}
          aria-label="Filtrar por expansión"
          className="rounded-lg border px-4 py-2"
        >
          <option value="">Todas las expansiones</option>

          {sets?.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>

        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-white">
          Buscar
        </button>

        {(search || setId !== undefined) && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-lg border px-5 py-2"
          >
            Limpiar filtros
          </button>
        )}
      </form>

      {isSetsError && (
        <p className="mb-4 text-sm text-red-600">No se han podido cargar las expansiones.</p>
      )}

      {isLoading ? (
        <p>Cargando cartas Pokémon...</p>
      ) : isError ? (
        <div>
          <p>No se han podido cargar las cartas.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-lg border px-4 py-2"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {isFetching && <p className="mb-4 text-sm text-gray-500">Actualizando resultados...</p>}

          {pagination && (
            <p className="mb-4 text-sm text-gray-500">{pagination.total} cartas encontradas</p>
          )}

          {cards.length === 0 ? (
            <p>No se encontraron cartas con los filtros seleccionados.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {cards.map((card) => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <nav
              aria-label="Paginación del catálogo"
              className="mt-8 flex items-center justify-center gap-4"
            >
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={page === 1 || isFetching}
                className="rounded-lg border px-4 py-2 disabled:opacity-50"
              >
                Anterior
              </button>

              <span className="text-sm">
                Página {pagination.page} de {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={page >= pagination.totalPages || isFetching}
                className="rounded-lg border px-4 py-2 disabled:opacity-50"
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
