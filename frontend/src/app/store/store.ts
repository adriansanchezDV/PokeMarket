import { configureStore } from '@reduxjs/toolkit';

import { baseApi } from '@/services/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { authListener } from './authListener';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListener.middleware).concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
