import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold">404 · Página no encontrada</h1>
      <p className="mb-6">La dirección que has abierto no existe.</p>
      <Link to="/" className="text-blue-600 underline">
        Volver al inicio
      </Link>
    </section>
  );
}
