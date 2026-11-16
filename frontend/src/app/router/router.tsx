import { createBrowserRouter } from 'react-router';

import { MainLayout } from '@/components/layout/MainLayaout';

import { ProtectedRoute } from './ProtectedRoute';

import { HomePage } from '@/features/home/pages/HomePage';
import { CatalogPage } from '@/features/catalog/cards/pages/CatalogPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage';
import { SetsPage } from '@/features/catalog/sets/pages/SetsPage';
import { OrdersPage } from '@/features/orders/pages/OrdersPage';
import { SellerDashboardPage } from '@/features/seller/pages/SellerDashboardPage';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { CardDetailPage } from '@/features/catalog/cards/pages/CardDetailPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      // Rutas públicas
      { index: true, Component: HomePage },
      { path: 'cards', Component: CatalogPage },
      { path: 'sets', Component: SetsPage },
      { path: 'login', Component: LoginPage },
      { path: 'forbidden', Component: ForbiddenPage },
      {
        path: 'register',
        Component: RegisterPage,
      },
      {
        path: '/cards/:id',
        Component: CardDetailPage,
      },

      // Rutas que requieren iniciar sesión
      {
        Component: ProtectedRoute,
        children: [{ path: 'orders', Component: OrdersPage }],
      },

      // Rutas exclusivas de vendedores
      {
        element: <ProtectedRoute allowedRoles={['seller']} />,
        children: [{ path: 'seller', Component: SellerDashboardPage }],
      },

      // Rutas exclusivas de administradores
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [{ path: 'admin', Component: AdminDashboardPage }],
      },
    ],
  },
]);
