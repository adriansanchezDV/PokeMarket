import { Link } from 'react-router';

import type { Product } from '../types/product.types';

interface ProductItemProps {
  product: Product;
}

export function ProductItem({ product }: ProductItemProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-lg">
      <Link to={`/products/${product.id}`} className="flex flex-1 flex-col p-4">
        {product.card.imageUrl ? (
          <img
            src={product.card.imageUrl}
            alt={`Carta ${product.card.name}`}
            className="h-64 w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-64 items-center justify-center bg-gray-100 text-sm text-gray-500">
            Imagen no disponible
          </div>
        )}

        <div className="mt-4 space-y-2">
          <h2 className="font-semibold">{product.card.name}</h2>

          <p className="text-sm text-gray-500">Nº {product.card.number}</p>

          <p className="text-sm">Estado: {product.condition}</p>

          <p className="text-sm">Idioma: {product.language}</p>

          <p className="text-sm">Stock: {product.stock}</p>

          <p className="text-xl font-bold">{Number(product.price).toFixed(2)} €</p>
        </div>
      </Link>

      <div className="border-t px-4 py-3">
        <Link
          to={`/stores/${product.sellerProfile.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          {product.sellerProfile.storeName}
        </Link>
      </div>
    </article>
  );
}
