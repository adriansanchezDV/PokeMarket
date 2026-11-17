import { baseApi } from '@/services/api/baseApi';

import type { ProductDetail, ProductsFilters, ProductsResponse } from '../types/product.types';

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<ProductsResponse, ProductsFilters | void>({
      query: (filters) => ({
        url: '/products',
        params: filters ?? {},
      }),
      providesTags: ['Products'],
    }),

    getProductById: builder.query<ProductDetail, number>({
      query: (id) => `/products/${id}`,
      providesTags: ['Products'],
    }),
  }),
});

export const { useGetProductsQuery, useGetProductByIdQuery } = productsApi;
