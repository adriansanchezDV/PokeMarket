import { Link } from 'react-router';

export function SellerDashboardPage() {
  return (
    <section className="mx-auto max-w-5xl p-6">
      <Link to="/account" className="mb-4 inline-block text-blue-600 underline">
        Volver a mi cuenta
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Bienvenido a tu espacio de vendedor</h1>

      <p className="mb-8 text-gray-600">
        Desde aquí podrás gestionar tu tienda, publicar cartas Pokémon y consultar tus ventas.
      </p>

      <nav aria-label="Opciones de vendedor">
        <ul className="space-y-4">
          <li>
            <Link to="/seller/products" className="block rounded-lg border p-4 hover:bg-gray-50">
              <h2 className="font-semibold">Mis productos</h2>
              <p className="text-sm text-gray-600">
                Gestión de anuncios pendiente de implementación.
              </p>
            </Link>
          </li>

          <li>
            <p className="rounded-lg border p-4 text-gray-500">
              <strong>Publicar producto</strong>
              <span className="block text-sm">Próximamente: poner cartas a la venta.</span>
            </p>
          </li>

          <li>
            <p className="rounded-lg border p-4 text-gray-500">
              <strong>Mi tienda</strong>
              <span className="block text-sm">Próximamente: consultar y editar tu tienda.</span>
            </p>
          </li>
          <li>
            <p className="rounded-lg border p-4 text-gray-500">
              <strong>Mis ventas</strong>
              <span className="block text-sm">Próximamente: consultar y gestionar tus ventas.</span>
            </p>
          </li>
        </ul>
      </nav>
    </section>
  );
}
