import { createListenerMiddleware } from '@reduxjs/toolkit';

import { logout } from '@/features/auth/store/authSlice';
import { baseApi } from '@/services/api/baseApi';

export const authListener = createListenerMiddleware();

authListener.startListening({
  actionCreator: logout,
  effect: async (_action, listenerApi) => {
    listenerApi.dispatch(baseApi.util.resetApiState());
  },
});
