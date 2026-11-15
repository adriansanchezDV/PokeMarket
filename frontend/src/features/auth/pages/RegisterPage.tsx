import { Link } from 'react-router';

import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
  return (
    <section className="mx-auto w-full max-w-md py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Crear cuenta</h1>

        <p className="mb-8 text-center text-sm text-gray-500">
          Regístrate para empezar a utilizar PokéMarket
        </p>

        <RegisterForm />

        <p className="mt-6 text-center text-sm">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-600">
            Inicia sesión
          </Link>
        </p>
      </div>
    </section>
  );
}
