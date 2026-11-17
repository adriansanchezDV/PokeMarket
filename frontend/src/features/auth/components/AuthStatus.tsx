import { Link, useNavigate } from 'react-router';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { clearAuthSession } from '../store/authSession';
export function AuthStatus() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { user, status, token } = useAppSelector((state) => state.auth);

  function handleLogout() {
    clearAuthSession(dispatch);
    navigate('/', { replace: true });
  }

  if (status === 'checking') {
    return <p role="status">Comprobando sesión...</p>;
  }

  if (status === 'error' && token) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/account" className="text-blue-600 underline">
          Revisar sesión
        </Link>
        <button type="button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return (
      <nav aria-label="Acceso a la cuenta" className="flex gap-4">
        <Link to="/login" className="font-medium text-blue-600">
          Iniciar sesión
        </Link>
        <Link to="/register" className="font-medium text-blue-600">
          Registrarse
        </Link>
      </nav>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm">
        Hola, <strong>{user.fullName || user.email}</strong>
      </span>

      <nav aria-label="Navegación de cuenta" className="flex gap-4">
        <Link to="/account" className="text-blue-600 underline">
          Mi cuenta
        </Link>
        {user.role === 'seller' && (
          <Link to="/seller" className="text-blue-600 underline">
            Panel de vendedor
          </Link>
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className="text-blue-600 underline">
            Administración
          </Link>
        )}
      </nav>

      <button type="button" onClick={handleLogout} className="rounded-lg border px-3 py-2 text-sm">
        Cerrar sesión
      </button>
    </div>
  );
}
