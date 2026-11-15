import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { User } from '../types/auth.types';
import { getStoredToken } from '../utils/authStorage';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  sessionId: number;
}

const storedToken = getStoredToken();

const initialState: AuthState = {
  user: null,
  token: storedToken,
  status: storedToken ? 'checking' : 'unauthenticated',
  sessionId: 0,
};

const authSlice = createSlice({
  name: 'auth',

  initialState,

  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.sessionId += 1;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.status = 'authenticated';
    },

    restoreToken: (state, action: PayloadAction<string>) => {
      state.sessionId += 1;
      state.user = null;
      state.token = action.payload;
      state.status = 'checking';
    },

    updateUser: (state, action: PayloadAction<{ user: User; sessionId: number }>) => {
      if (
        state.sessionId !== action.payload.sessionId ||
        !state.token ||
        state.status !== 'checking'
      ) {
        return;
      }

      state.user = action.payload.user;
      state.status = 'authenticated';
    },

    sessionValidationError: (state, action: PayloadAction<number>) => {
      if (state.sessionId !== action.payload || state.status !== 'checking') {
        return;
      }

      state.user = null;
      state.status = 'error';
    },

    logout: (state) => {
      state.sessionId += 1;
      state.user = null;
      state.token = null;
      state.status = 'unauthenticated';
    },
  },
});

export const { setCredentials, restoreToken, updateUser, sessionValidationError, logout } =
  authSlice.actions;

export default authSlice.reducer;
