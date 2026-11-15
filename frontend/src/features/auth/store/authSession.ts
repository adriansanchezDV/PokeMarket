import type { AppDispatch, RootState } from '@/app/store/store';

import { logout } from './authSlice';
import { removeToken } from '../utils/authStorage';

export function clearAuthSession(dispatch: AppDispatch): void {
  removeToken();
  dispatch(logout());
}

export function clearAuthSessionIfCurrent(sessionId: number) {
  return (dispatch: AppDispatch, getState: () => RootState): void => {
    if (getState().auth.sessionId !== sessionId) {
      return;
    }

    clearAuthSession(dispatch);
  };
}
