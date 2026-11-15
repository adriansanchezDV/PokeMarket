import { Link } from 'react-router';

export function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-lg py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold">Acceso denegado</h1>

      <p className="mb-6 text-gray-600">No tienes permisos para acceder a esta página.</p>

      <Link to="/" className="font-medium text-blue-600">
        Volver al inicio
      </Link>
    </section>
  );
}
