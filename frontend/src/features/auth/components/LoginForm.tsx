import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

import { useAppDispatch } from '@/app/store/hooks';
import { useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';

import { saveToken } from '../utils/authStorage';

export function LoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from;
  const redirectTo =
    from && typeof from.pathname === 'string'
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : '/';

  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const response = await login({ email, password }).unwrap();

      saveToken(response.token);
      dispatch(setCredentials(response));

      navigate(redirectTo, { replace: true });
    } catch {
      setError('No se ha podido iniciar sesión. Comprueba tus credenciales.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Correo electrónico
        </label>

        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3"
          placeholder="correo@ejemplo.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>

        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3"
          placeholder="Introduce tu contraseña"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
