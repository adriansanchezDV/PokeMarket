import { Link } from 'react-router';

import type { Store } from '../types/store.types';

interface StoreItemProps {
  store: Store;
}

export function StoreItem({ store }: StoreItemProps) {
  return (
    <article className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-lg">
      <Link to={`/stores/${store.id}`}>
        <h2 className="text-xl font-semibold hover:text-blue-600">{store.storeName}</h2>
      </Link>

      <p className="mt-3 text-sm text-gray-600">{store.description || 'Sin descripción'}</p>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">{store.productCount}</p>
          <p className="text-gray-500">Productos</p>
        </div>

        <div>
          <p className="font-semibold">{store.salesCount}</p>
          <p className="text-gray-500">Unidades vendidas</p>
        </div>

        <div>
          <p className="font-semibold">
            {store.reviewCount > 0 ? `${store.averageRating.toFixed(1)} / 5` : 'Sin valorar'}
          </p>
          <p className="text-gray-500">Valoración</p>
        </div>

        <div>
          <p className="font-semibold">{store.reviewCount}</p>
          <p className="text-gray-500">Reseñas</p>
        </div>
      </div>

      <Link
        to={`/stores/${store.id}`}
        className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Ver tienda
      </Link>
    </article>
  );
}
