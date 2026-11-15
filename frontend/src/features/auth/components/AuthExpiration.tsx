import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { clearAuthSessionIfCurrent } from '../store/authSession';
import { getTokenExpiration } from '../utils/authToken';

export function AuthExpiration() {
  const dispatch = useAppDispatch();

  const { token, sessionId } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!token) {
      return;
    }

    const expiration = getTokenExpiration(token);

    if (expiration === null) {
      return;
    }

    function checkExpiration() {
      if (expiration !== null && Date.now() >= expiration) {
        dispatch(clearAuthSessionIfCurrent(sessionId));
      }
    }

    checkExpiration();

    const remainingTime = expiration - Date.now();

    if (remainingTime <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(checkExpiration, remainingTime);

    document.addEventListener('visibilitychange', checkExpiration);
    window.addEventListener('focus', checkExpiration);

    return () => {
      window.clearTimeout(timeoutId);

      document.removeEventListener('visibilitychange', checkExpiration);

      window.removeEventListener('focus', checkExpiration);
    };
  }, [token, sessionId, dispatch]);

  return null;
}
