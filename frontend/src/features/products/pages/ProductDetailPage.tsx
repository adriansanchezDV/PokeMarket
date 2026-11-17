import { Link, useParams } from 'react-router';

import { useGetProductByIdQuery } from '../api/productsApi';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  const productId = Number(id);

  const isValidId = id !== undefined && Number.isInteger(productId) && productId > 0;

  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetProductByIdQuery(productId, {
    skip: !isValidId,
  });

  if (!isValidId) {
    return <p className="p-6">El identificador del producto no es válido.</p>;
  }

  if (isLoading) {
    return <p className="p-6">Cargando producto...</p>;
  }

  if (isError) {
    const isNotFound = error && 'status' in error && error.status === 404;

    return (
      <section className="p-6">
        <p>
          {isNotFound
            ? 'El producto no existe o no está disponible.'
            : 'No se ha podido cargar el producto.'}
        </p>

        {!isNotFound && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-lg border px-4 py-2"
          >
            Reintentar
          </button>
        )}
      </section>
    );
  }

  if (!product) {
    return <p className="p-6">Producto no disponible.</p>;
  }

  return (
    <section className="mx-auto max-w-6xl p-6">
      <Link to="/products" className="mb-6 inline-block text-sm text-blue-600 hover:underline">
        ← Volver a productos
      </Link>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          {product.card.imageUrl ? (
            <img
              src={product.card.imageUrl}
              alt={`Carta ${product.card.name}`}
              className="mx-auto max-h-[500px] w-full object-contain"
            />
          ) : (
            <div className="flex h-96 items-center justify-center bg-gray-100">
              Imagen no disponible
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-bold">{product.card.name}</h1>

            <p className="mt-2 text-gray-500">Nº {product.card.number}</p>

            {product.card.rarity && <p className="text-sm text-gray-500">{product.card.rarity}</p>}
          </div>

          <p className="text-3xl font-bold">{Number(product.price).toFixed(2)} €</p>

          <div className="space-y-2 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Información del producto</h2>

            <p>Estado: {product.condition}</p>
            <p>Idioma: {product.language}</p>
            <p>Stock disponible: {product.stock}</p>

            <p>Disponibilidad: {product.isActive ? 'Anuncio activo' : 'Anuncio desactivado'}</p>
          </div>

          <div className="rounded-xl border p-5">
            <h2 className="mb-2 text-lg font-semibold">Vendedor</h2>

            <Link
              to={`/stores/${product.sellerProfile.id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {product.sellerProfile.storeName}
            </Link>

            {product.sellerProfile.description && (
              <p className="mt-2 text-sm text-gray-600">{product.sellerProfile.description}</p>
            )}
          </div>

          {product.description && (
            <div className="rounded-xl border p-5">
              <h2 className="mb-2 text-lg font-semibold">Descripción del vendedor</h2>

              <p>{product.description}</p>
            </div>
          )}

          <Link
            to={`/cards/${product.card.id}`}
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            Ver información de la carta Pokémon
          </Link>
        </div>
      </div>
    </section>
  );
}
