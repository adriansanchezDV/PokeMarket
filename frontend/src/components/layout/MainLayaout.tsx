import { Link, NavLink, Outlet } from 'react-router';

import { AuthStatus } from '@/features/auth/components/AuthStatus';

export function MainLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
        <Link to="/" className="text-xl font-bold">
          PokéMarket
        </Link>

        <nav aria-label="Navegación principal" className="flex flex-wrap gap-4">
          <NavLink to="/cards" className="text-blue-600 underline">
            Cartas
          </NavLink>
          <NavLink to="/sets" className="text-blue-600 underline">
            Expansiones
          </NavLink>
          <NavLink to="/products" className="text-blue-600 underline">
            Productos
          </NavLink>
          <NavLink to="/stores" className="text-blue-600 underline">
            Tiendas
          </NavLink>
        </nav>

        <AuthStatus />
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
