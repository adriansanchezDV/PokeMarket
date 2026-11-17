import { useState } from 'react';

import { useGetSetsQuery } from '@/features/catalog/sets/api/setsApi';

import type { ProductOrder, ProductSort } from '../types/product.types';

export interface ProductFilterValues {
  search: string;
  setId: string;
  minPrice: string;
  maxPrice: string;
  condition: string;
  language: string;
  sort: ProductSort;
  order: ProductOrder;
}

interface ProductsFiltersProps {
  filters: ProductFilterValues;
  onApply: (filters: ProductFilterValues) => void;
  onClear: () => void;
}

export function ProductsFilters({ filters, onApply, onClear }: ProductsFiltersProps) {
  const [draft, setDraft] = useState(filters);

  const { data: sets = [] } = useGetSetsQuery();

  const updateDraft = (field: keyof ProductFilterValues, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const minPrice = draft.minPrice === '' ? undefined : Number(draft.minPrice);

    const maxPrice = draft.maxPrice === '' ? undefined : Number(draft.maxPrice);

    if (
      (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    ) {
      return;
    }

    onApply(draft);
  };

  const handleClear = () => {
    const emptyFilters: ProductFilterValues = {
      search: '',
      setId: '',
      minPrice: '',
      maxPrice: '',
      condition: '',
      language: '',
      sort: 'createdAt',
      order: 'DESC',
    };

    setDraft(emptyFilters);
    onClear();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 space-y-5 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Filtrar productos</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Buscar carta
          <input
            type="search"
            value={draft.search}
            onChange={(event) => updateDraft('search', event.target.value)}
            placeholder="Nombre, número, artista..."
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Expansión
          <select
            value={draft.setId}
            onChange={(event) => updateDraft('setId', event.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Todas las expansiones</option>

            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Estado
          <select
            value={draft.condition}
            onChange={(event) => updateDraft('condition', event.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Todos los estados</option>
            <option value="Mint">Mint</option>
            <option value="Near Mint">Near Mint</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Played">Played</option>
            <option value="Poor">Poor</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Idioma
          <select
            value={draft.language}
            onChange={(event) => updateDraft('language', event.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Todos los idiomas</option>
            <option value="English">Inglés</option>
            <option value="Spanish">Español</option>
            <option value="Japanese">Japonés</option>
            <option value="French">Francés</option>
            <option value="German">Alemán</option>
            <option value="Italian">Italiano</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Precio mínimo (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.minPrice}
            onChange={(event) => updateDraft('minPrice', event.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Precio máximo (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.maxPrice}
            onChange={(event) => updateDraft('maxPrice', event.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Ordenar por
          <select
            value={draft.sort}
            onChange={(event) => updateDraft('sort', event.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="createdAt">Fecha</option>
            <option value="price">Precio</option>
            <option value="stock">Stock</option>
            <option value="id">Identificador</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Orden
          <select
            value={draft.order}
            onChange={(event) => updateDraft('order', event.target.value)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="ASC">Ascendente</option>
            <option value="DESC">Descendente</option>
          </select>
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-white">
          Aplicar filtros
        </button>

        <button type="button" onClick={handleClear} className="rounded-lg border px-5 py-2">
          Limpiar filtros
        </button>
      </div>
    </form>
  );
}
