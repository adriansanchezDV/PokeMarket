import { Link } from 'react-router';
import { useAppSelector } from '@/app/store/hooks';

export function AccountDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Mi cuenta</h1>

      <p>Bienvenido, {user?.fullName || user?.email}</p>

      <nav aria-label="Opciones de cuenta">
        <ul className="space-y-4">
          <li>Mis favoritos — Próximamente</li>
          <li>Mi carrito — Próximamente</li>
          <li>Mis direcciones — Próximamente</li>
          <li>
            <Link to="/orders" className="text-blue-600 underline">
              Mis compras
            </Link>{' '}
            (pendiente de implementación)
          </li>

          {user?.role === 'customer' && (
            <li>
              <Link to="/become-seller">Crear mi tienda</Link>
            </li>
          )}

          {user?.role === 'seller' && (
            <li>
              <Link to="/seller">Gestionar mi tienda</Link>
            </li>
          )}

          {user?.role === 'admin' && (
            <li>
              <Link to="/admin">Administración</Link>
            </li>
          )}
        </ul>
      </nav>
    </section>
  );
}
