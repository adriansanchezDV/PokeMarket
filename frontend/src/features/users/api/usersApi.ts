import { baseApi } from '@/services/api/baseApi';

import type { UserProfile } from '@/features/auth/types/auth.types';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<UserProfile, number>({
      query: () => '/users/me',
      providesTags: ['User'],
    }),
  }),
});

export const { useGetMeQuery } = usersApi;
