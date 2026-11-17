import { baseApi } from '@/services/api/baseApi';

import type {
  CreateSellerProfileRequest,
  CreateSellerProfileResponse,
  SellerProfile,
  UpdateSellerProfileRequest,
} from '../types/sellerProfile.types';

export const sellerProfileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createSellerProfile: builder.mutation<CreateSellerProfileResponse, CreateSellerProfileRequest>({
      query: (body) => ({
        url: '/sellers/profile',
        method: 'POST',
        body,
      }),
      // La aceptación del nuevo token reinicia la caché desde authListener.
    }),

    updateSellerProfile: builder.mutation<SellerProfile, UpdateSellerProfileRequest>({
      query: (body) => ({
        url: '/sellers/profile',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Products'],
    }),
  }),
});

export const { useCreateSellerProfileMutation, useUpdateSellerProfileMutation } = sellerProfileApi;
