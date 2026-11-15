import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

import type { RootState } from '@/app/store/store';
import { clearAuthSession } from '@/features/auth/store/authSession';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',

  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  },
});

export const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const authBeforeRequest = (api.getState() as RootState).auth;

  const tokenBeforeRequest = authBeforeRequest.token;
  const sessionIdBeforeRequest = authBeforeRequest.sessionId;

  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401 || !tokenBeforeRequest) {
    return result;
  }

  const currentAuth = (api.getState() as RootState).auth;

  const isSameSession =
    currentAuth.token === tokenBeforeRequest && currentAuth.sessionId === sessionIdBeforeRequest;

  if (isSameSession) {
    clearAuthSession(api.dispatch);
  }

  return result;
};
