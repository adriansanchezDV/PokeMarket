import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

import { logout, restoreToken, setCredentials } from '@/features/auth/store/authSlice';
import { removeToken, saveToken } from '@/features/auth/utils/authStorage';
import { baseApi } from '@/services/api/baseApi';

export const authListener = createListenerMiddleware();

authListener.startListening({
  matcher: isAnyOf(logout, restoreToken, setCredentials),
  effect: (action, listenerApi) => {
    if (setCredentials.match(action)) {
      saveToken(action.payload.token);
    } else if (logout.match(action)) {
      removeToken();
    }

    // Las consultas personalizadas no deben sobrevivir a un cambio de sesión.
    listenerApi.dispatch(baseApi.util.resetApiState());
  },
});
