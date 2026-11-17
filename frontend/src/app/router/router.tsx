import { createBrowserRouter } from 'react-router';

// Layouts
import { MainLayout } from '@/components/layout/MainLayaout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { AccountDashboardPage } from '@/features/users/pages/AccountDashboardPage';

// Protección de rutas
import { ProtectedRoute } from './ProtectedRoute';

// Home
import { HomePage } from '@/features/home/pages/HomePage';

// Autenticación
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage';

// Catálogo Pokémon
import { CatalogPage } from '@/features/catalog/cards/pages/CatalogPage';
import { CardDetailPage } from '@/features/catalog/cards/pages/CardDetailPage';
import { SetsPage } from '@/features/catalog/sets/pages/SetsPage';

// Productos públicos
import { ProductsPage } from '@/features/products/pages/ProductsPage';
import { ProductDetailPage } from '@/features/products/pages/ProductDetailPage';

// Tiendas públicas
import { StoresPage } from '@/features/store/pages/StoresPage';
import { StoreDetailPage } from '@/features/store/pages/StoreDetailPage';

// Pedidos
import { OrdersPage } from '@/features/orders/pages/OrdersPage';

// Vendedores
import { CreateSellerPage } from '@/features/seller/pages/CreateSellerPage';
import { SellerProductsPage } from '@/features/seller/pages/SellerProductsPage';

// Administración
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { SellerDashboardPage } from '@/features/seller/pages/SellerDashboardPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,

    children: [
      // ========================================
      // 1. RUTAS PÚBLICAS
      // ========================================

      { index: true, Component: HomePage },

      // Autenticación
      { path: 'login', Component: LoginPage },
      { path: 'register', Component: RegisterPage },
      { path: 'forbidden', Component: ForbiddenPage },

      // Catálogo Pokémon
      { path: 'cards', Component: CatalogPage },
      { path: 'cards/:id', Component: CardDetailPage },
      { path: 'sets', Component: SetsPage },

      // Productos
      { path: 'products', Component: ProductsPage },
      { path: 'products/:id', Component: ProductDetailPage },

      // Tiendas
      { path: 'stores', Component: StoresPage },
      { path: 'stores/:id', Component: StoreDetailPage },

      // ========================================
      // 2. USUARIOS AUTENTICADOS
      // ========================================

      {
        Component: ProtectedRoute,
        children: [
          { path: 'account', Component: AccountDashboardPage },
          { path: 'orders', Component: OrdersPage },
        ],
      },

      // ========================================
      // 3. CLIENTES QUE QUIEREN SER VENDEDORES
      // ========================================

      {
        // La conversión actualiza Redux antes de navegar: ambos caminos deben ir a /seller.
        element: (
          <ProtectedRoute allowedRoles={['customer']} redirectByRole={{ seller: '/seller' }} />
        ),
        children: [
          {
            path: 'become-seller',
            Component: CreateSellerPage,
          },
        ],
      },

      // ========================================
      // 4. RUTAS EXCLUSIVAS DE VENDEDORES
      // ========================================

      {
        element: <ProtectedRoute allowedRoles={['seller']} />,
        children: [
          {
            path: 'seller/products',
            Component: SellerProductsPage,
          },
          {
            path: 'seller',
            Component: SellerDashboardPage,
          },
        ],
      },

      // ========================================
      // 5. RUTAS EXCLUSIVAS DE ADMINISTRADORES
      // ========================================

      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          {
            path: 'admin',
            Component: AdminDashboardPage,
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
