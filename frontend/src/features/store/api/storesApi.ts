import { baseApi } from '@/services/api/baseApi';

import type { Store, StoreDetail, StoreProduct } from '../types/store.types';

export const storesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStores: builder.query<Store[], void>({
      query: () => '/stores',
    }),

    getStoreById: builder.query<StoreDetail, number>({
      query: (id) => `/stores/${id}`,
    }),

    getStoreProducts: builder.query<StoreProduct[], number>({
      query: (id) => `/stores/${id}/products`,
    }),
  }),
});

export const { useGetStoresQuery, useGetStoreByIdQuery, useGetStoreProductsQuery } = storesApi;
