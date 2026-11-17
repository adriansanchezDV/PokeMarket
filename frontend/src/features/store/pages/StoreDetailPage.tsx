import { Link, useParams } from 'react-router';

import { useGetStoreByIdQuery, useGetStoreProductsQuery } from '../api/storesApi';

export function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();

  const storeId = Number(id);

  const isValidId = id !== undefined && Number.isInteger(storeId) && storeId > 0;

  const {
    data: store,
    isLoading: isLoadingStore,
    isError: isStoreError,
    error: storeError,
    refetch: refetchStore,
  } = useGetStoreByIdQuery(storeId, {
    skip: !isValidId,
  });

  const {
    data: products,
    isLoading: isLoadingProducts,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useGetStoreProductsQuery(storeId, {
    skip: !isValidId || !store?.isActive,
  });

  if (!isValidId) {
    return <p className="p-6">Identificador de tienda no válido.</p>;
  }

  if (isLoadingStore) {
    return <p className="p-6">Cargando tienda...</p>;
  }

  if (isStoreError) {
    const notFound = storeError && 'status' in storeError && storeError.status === 404;

    return (
      <section className="p-6">
        <p>{notFound ? 'No se ha encontrado la tienda.' : 'No se ha podido cargar la tienda.'}</p>

        {!notFound && (
          <button
            type="button"
            onClick={() => void refetchStore()}
            className="mt-4 rounded-lg border px-4 py-2"
          >
            Reintentar
          </button>
        )}
      </section>
    );
  }

  if (!store || !store.isActive) {
    return <p className="p-6">Tienda no disponible.</p>;
  }

  return (
    <section className="mx-auto max-w-7xl p-6">
      <Link to="/stores" className="mb-6 inline-block text-blue-600 hover:underline">
        ← Volver a tiendas
      </Link>

      <div className="rounded-xl border p-6">
        <h1 className="text-3xl font-bold">{store.storeName}</h1>

        <p className="mt-3 text-gray-600">
          {store.description || 'Esta tienda no tiene descripción.'}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold">{store.productCount}</p>
            <p className="text-sm text-gray-500">Productos</p>
          </div>

          <div>
            <p className="text-2xl font-bold">{store.salesCount}</p>
            <p className="text-sm text-gray-500">Unidades vendidas</p>
          </div>

          <div>
            <p className="text-2xl font-bold">
              {store.reviewCount > 0 ? store.averageRating.toFixed(1) : '—'}
            </p>
            <p className="text-sm text-gray-500">Valoración</p>
          </div>

          <div>
            <p className="text-2xl font-bold">{store.reviewCount}</p>
            <p className="text-sm text-gray-500">Reseñas</p>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-6 text-2xl font-bold">Productos de la tienda</h2>

        {isLoadingProducts && <p>Cargando productos...</p>}

        {isProductsError && (
          <div>
            <p>No se han podido cargar los productos.</p>

            <button
              type="button"
              onClick={() => void refetchProducts()}
              className="mt-3 rounded-lg border px-4 py-2"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoadingProducts && !isProductsError && (
          <>
            {!products?.length ? (
              <p>Esta tienda todavía no tiene productos disponibles.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="rounded-xl border p-4 transition-shadow hover:shadow-lg"
                  >
                    {product.card.imageUrl ? (
                      <img
                        src={product.card.imageUrl}
                        alt={product.card.name}
                        className="h-64 w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center bg-gray-100 text-sm">
                        Imagen no disponible
                      </div>
                    )}

                    <h3 className="mt-4 font-semibold">{product.card.name}</h3>

                    <p className="mt-2 text-sm">Estado: {product.condition}</p>

                    <p className="text-sm">Idioma: {product.language}</p>

                    <p className="mt-3 text-xl font-bold">{Number(product.price).toFixed(2)} €</p>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
