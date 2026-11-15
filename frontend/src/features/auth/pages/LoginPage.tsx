import { Link, useLocation } from 'react-router';

import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const location = useLocation();

  const registrationSuccess = location.state?.registrationSuccess === true;

  return (
    <section className="mx-auto w-full max-w-md py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Iniciar sesión</h1>

        <p className="mb-8 text-center text-sm text-gray-500">Accede a tu cuenta de PokéMarket</p>

        {registrationSuccess && (
          <p role="status" className="mb-6 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Tu cuenta se ha creado correctamente. Ya puedes iniciar sesión.
          </p>
        )}

        <LoginForm />

        <p className="mt-6 text-center text-sm">
          ¿Todavía no tienes cuenta?{' '}
          <Link to="/register" className="font-medium text-blue-600">
            Regístrate
          </Link>
        </p>
      </div>
    </section>
  );
}
