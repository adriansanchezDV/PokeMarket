import { Link, useNavigate } from 'react-router';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { baseApi } from '@/services/api/baseApi';
import { logout } from '../store/authSlice';

export function AuthStatus() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const user = useAppSelector((state) => state.auth.user);

  function handleLogout() {
    dispatch(logout());
    dispatch(baseApi.util.resetApiState());
    navigate('/');
  }

  if (!user) {
    return (
      <Link to="/login" className="font-medium text-blue-600">
        Iniciar sesión
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">
        Hola, <strong>{user.fullName}</strong>
      </span>

      <button type="button" onClick={handleLogout} className="rounded-lg border px-3 py-2 text-sm">
        Cerrar sesión
      </button>
    </div>
  );
}
