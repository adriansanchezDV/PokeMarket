import { useGetStoresQuery } from '../api/storesApi';
import { StoreItem } from '../components/StoreItem';

export function StoresPage() {
  const { data: stores, isLoading, isError, refetch } = useGetStoresQuery();

  if (isLoading) {
    return <p className="p-6">Cargando tiendas...</p>;
  }

  if (isError) {
    return (
      <section className="p-6">
        <p>No se han podido cargar las tiendas.</p>

        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg border px-4 py-2"
        >
          Reintentar
        </button>
      </section>
    );
  }

  const activeStores = (stores ?? []).filter((store) => store.isActive);

  return (
    <section className="mx-auto max-w-7xl p-6">
      <h1 className="mb-3 text-3xl font-bold">Tiendas Pokémon</h1>

      <p className="mb-8 text-gray-600">Descubre los vendedores de PokéMarket y sus productos.</p>

      {activeStores.length === 0 ? (
        <p>No hay tiendas disponibles actualmente.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeStores.map((store) => (
            <StoreItem key={store.id} store={store} />
          ))}
        </div>
      )}
    </section>
  );
}
