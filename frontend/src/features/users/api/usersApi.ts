import { baseApi } from '@/services/api/baseApi';

import type { User } from '@/features/auth/types/auth.types';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<User, number>({
      query: () => '/users/me',
      providesTags: ['User'],
    }),
  }),
});

export const { useGetMeQuery } = usersApi;
