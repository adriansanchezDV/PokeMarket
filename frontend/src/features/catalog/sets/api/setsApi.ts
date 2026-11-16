import { baseApi } from '@/services/api/baseApi';

import type { PokemonSet } from '../types/set.types';

export const setsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSets: builder.query<PokemonSet[], void>({
      query: () => '/sets',
      providesTags: ['Sets'],
    }),
  }),
});

export const { useGetSetsQuery } = setsApi;
