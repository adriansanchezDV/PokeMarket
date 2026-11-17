import type { AppDispatch, RootState } from '@/app/store/store';

import { logout, setCredentials } from './authSlice';
import type { AuthResponse } from '../types/auth.types';

export function clearAuthSession(dispatch: AppDispatch): void {
  dispatch(logout());
}

export function setAuthSessionIfCurrent(credentials: AuthResponse, sessionId: number) {
  return (dispatch: AppDispatch, getState: () => RootState): boolean => {
    if (getState().auth.sessionId !== sessionId) {
      return false;
    }

    dispatch(setCredentials(credentials));
    return true;
  };
}

export function clearAuthSessionIfCurrent(sessionId: number) {
  return (dispatch: AppDispatch, getState: () => RootState): void => {
    if (getState().auth.sessionId !== sessionId) {
      return;
    }

    clearAuthSession(dispatch);
  };
}
