import { useSearchParams } from 'react-router';

import { useGetProductsQuery } from '../api/productsApi';
import { ProductItem } from '../components/ProductItem';
import { ProductsFilters, type ProductFilterValues } from '../components/ProductsFilters';

import type { ProductOrder, ProductSort } from '../types/product.types';

const PAGE_LIMIT = 20;

const allowedSorts: ProductSort[] = ['id', 'price', 'stock', 'createdAt'];

function getNonNegativeNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined;

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function getPositiveInteger(value: string | null) {
  if (value === null || value.trim() === '') return undefined;

  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortParam = searchParams.get('sort');

  const sort: ProductSort = allowedSorts.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : 'createdAt';

  const order: ProductOrder = searchParams.get('order') === 'ASC' ? 'ASC' : 'DESC';

  const page = getPositiveInteger(searchParams.get('page')) ?? 1;

  const filters: ProductFilterValues = {
    search: searchParams.get('search') ?? '',
    setId: searchParams.get('setId') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    condition: searchParams.get('condition') ?? '',
    language: searchParams.get('language') ?? '',
    sort,
    order,
  };

  const minPrice = getNonNegativeNumber(filters.minPrice);
  const maxPrice = getNonNegativeNumber(filters.maxPrice);

  const hasInvalidPriceRange =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery(
    {
      search: filters.search || undefined,
      setId: getPositiveInteger(filters.setId),
      minPrice,
      maxPrice,
      condition: filters.condition || undefined,
      language: filters.language || undefined,
      sort,
      order,
      page,
      limit: PAGE_LIMIT,
    },
    {
      skip: hasInvalidPriceRange,
    },
  );

  const products = data?.data ?? [];
  const pagination = data?.pagination;

  const handleApplyFilters = (values: ProductFilterValues) => {
    const params = new URLSearchParams();

    if (values.search.trim()) {
      params.set('search', values.search.trim());
    }

    if (values.setId) params.set('setId', values.setId);
    if (values.minPrice) params.set('minPrice', values.minPrice);
    if (values.maxPrice) params.set('maxPrice', values.maxPrice);
    if (values.condition) params.set('condition', values.condition);
    if (values.language) params.set('language', values.language);

    params.set('sort', values.sort);
    params.set('order', values.order);
    params.set('page', '1');

    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);

    params.set('page', String(nextPage));

    setSearchParams(params);
  };

  return (
    <section className="mx-auto max-w-7xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Productos en venta</h1>

      <ProductsFilters
        key={searchParams.toString()}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {hasInvalidPriceRange ? (
        <p className="text-red-600">El precio mínimo no puede superar el máximo.</p>
      ) : (
        <>
          {isLoading && <p>Cargando productos...</p>}

          {isError && (
            <div className="space-y-3">
              <p>No se han podido cargar los productos.</p>

              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded-lg border px-4 py-2"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <div className="mb-4 flex justify-between">
                <p className="text-sm text-gray-600">
                  {pagination?.total ?? 0} productos encontrados
                </p>

                {isFetching && <p className="text-sm text-gray-500">Actualizando...</p>}
              </div>

              {products.length === 0 ? (
                <p>No se han encontrado productos.</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))}
                </div>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => changePage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border px-4 py-2 disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="text-sm">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => changePage(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="rounded-lg border px-4 py-2 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
