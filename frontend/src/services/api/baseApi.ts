import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQueryWithAuth } from './baseQueryWithAuth';

export const baseApi = createApi({
  reducerPath: 'api',

  baseQuery: baseQueryWithAuth,

  tagTypes: ['User', 'Products', 'Cards', 'Sets', 'Favorites', 'Cart', 'Orders', 'Notifications'],

  endpoints: () => ({}),
});
