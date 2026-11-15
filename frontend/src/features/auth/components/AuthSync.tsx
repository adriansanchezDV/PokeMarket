import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { useGetMeQuery } from '@/features/users/api/usersApi';

import { clearAuthSessionIfCurrent } from '../store/authSession';
import { sessionValidationError, updateUser } from '../store/authSlice';

export function AuthSync() {
  const dispatch = useAppDispatch();

  const { token, status, sessionId } = useAppSelector((state) => state.auth);

  const {
    data: user,
    error,
    isSuccess,
    isError,
  } = useGetMeQuery(sessionId, {
    skip: !token,
  });

  useEffect(() => {
    if (!token || status !== 'checking') {
      return;
    }

    if (isSuccess && user) {
      dispatch(updateUser({ user, sessionId }));
      return;
    }

    if (!isError) {
      return;
    }

    if (error && 'status' in error && error.status === 403) {
      dispatch(clearAuthSessionIfCurrent(sessionId));
      return;
    }

    if (error && 'status' in error && error.status === 401) {
      return;
    }

    dispatch(sessionValidationError(sessionId));
  }, [token, status, sessionId, user, error, isSuccess, isError, dispatch]);

  return null;
}
