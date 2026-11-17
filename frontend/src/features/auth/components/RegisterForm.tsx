import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useRegisterMutation } from '../api/authApi';
import { getApiErrorMessage } from '@/services/api/apiError';

export function RegisterForm() {
  const navigate = useNavigate();

  const [register, { isLoading }] = useRegisterMutation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      await register({
        fullName: fullName.trim() || undefined,
        email: email.trim(),
        password,
      }).unwrap();

      navigate('/login', {
        replace: true,
        state: { registrationSuccess: true },
      });
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'No se ha podido completar el registro.'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="fullName" className="text-sm font-medium">
          Nombre completo (opcional)
        </label>

        <input
          id="fullName"
          type="text"
          autoComplete="name"
          minLength={2}
          maxLength={255}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3"
          placeholder="Tu nombre completo"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="registerEmail" className="text-sm font-medium">
          Correo electrónico
        </label>

        <input
          id="registerEmail"
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
        <label htmlFor="registerPassword" className="text-sm font-medium">
          Contraseña
        </label>

        <input
          id="registerPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirmar contraseña
        </label>

        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3"
          placeholder="Repite tu contraseña"
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
        {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  );
}
