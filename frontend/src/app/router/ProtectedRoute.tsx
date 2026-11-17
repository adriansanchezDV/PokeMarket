import { Navigate, Outlet, useLocation } from 'react-router';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { restoreToken } from '@/features/auth/store/authSlice';

import type { UserRole } from '@/features/auth/types/auth.types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  redirectByRole?: Partial<Record<UserRole, string>>;
}

export function ProtectedRoute({ allowedRoles, redirectByRole }: ProtectedRouteProps) {
  const dispatch = useAppDispatch();

  const { user, token, status } = useAppSelector((state) => state.auth);

  const location = useLocation();

  if (status === 'checking') {
    return (
      <div role="status" className="p-8 text-center">
        Comprobando sesión...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="space-y-4 p-8 text-center">
        <p>No se ha podido comprobar tu sesión. Comprueba tu conexión e inténtalo de nuevo.</p>

        <button
          type="button"
          onClick={() => {
            if (token) {
              dispatch(restoreToken(token));
            }
          }}
          className="rounded-lg border px-4 py-2"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (status !== 'authenticated' || !user || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectByRole?.[user.role] ?? '/forbidden'} replace />;
  }

  return <Outlet />;
}
