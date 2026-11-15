import { Link, Outlet } from 'react-router';

import { AuthStatus } from '@/features/auth/components/AuthStatus';

export function MainLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <Link to="/" className="text-xl font-bold">
          PokéMarket
        </Link>

        <AuthStatus />
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
