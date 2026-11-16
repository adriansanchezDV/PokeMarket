import { baseApi } from '@/services/api/baseApi';

import type { CardDetail, CardsFilters, CardsResponse } from '../types/card.types';

export const cardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCards: builder.query<CardsResponse, CardsFilters | void>({
      query: (filters) => ({
        url: '/cards',
        params: filters ?? {},
      }),
      providesTags: ['Cards'],
    }),

    getCardById: builder.query<CardDetail, number>({
      query: (id) => `/cards/${id}`,
      providesTags: ['Cards'],
    }),
  }),
});

export const { useGetCardsQuery, useGetCardByIdQuery } = cardsApi;
