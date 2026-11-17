import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { useGetMeQuery } from '@/features/users/api/usersApi';

import { clearAuthSessionIfCurrent } from '../store/authSession';
import { sessionValidationError, updateUser } from '../store/authSlice';

export function AuthSync() {
  const dispatch = useAppDispatch();

  const { token, status, sessionId } = useAppSelector((state) => state.auth);

  const {
    currentData: user,
    error,
    isSuccess,
    isError,
    isFetching,
  } = useGetMeQuery(sessionId, {
    skip: !token,
  });

  useEffect(() => {
    if (!token || isFetching || (status !== 'checking' && status !== 'authenticated')) {
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

    if (status === 'checking') {
      dispatch(sessionValidationError(sessionId));
    }
  }, [token, status, sessionId, user, error, isSuccess, isError, isFetching, dispatch]);

  return null;
}
