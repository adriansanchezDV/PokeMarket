# Cobertura de testing

Referencia actual: **641 escenarios: 612 de integración y 29 unitarios**, en
46 archivos. Los archivos se indican respecto a `tests/`; las filas agrupadas
incluyen pruebas funcionales, Redis o concurrencia. No se sustituyen servicios
internos ni consultas SQL.

| Módulo                | Archivos                                                                         |   Casos | Cobertura principal                                                                     |
| --------------------- | -------------------------------------------------------------------------------- | ------: | --------------------------------------------------------------------------------------- |
| Guardas unitarias     | `unit/config/testDatabaseControl.test.ts`, `unit/config/testEnvironment.test.ts` |      29 | Entorno, instancia/base real, alcance de limpieza, Redis aislado y rutas Windows/POSIX  |
| Aplicación            | `integration/app.test.ts`                                                        |       2 | Ping y health                                                                           |
| Autenticación         | `integration/auth/` (5)                                                          |      55 | Registro, login, JWT, baneo, roles y emails normalizados/históricos/concurrentes        |
| Usuarios              | `integration/users/` (2)                                                         |      25 | Perfil, validaciones, campos protegidos, aislamiento y persistencia                     |
| Perfil vendedor       | `integration/sellerProfile/` (2)                                                 |      35 | Alta, JWT con nuevo rol, edición, propiedad y desactivación                             |
| Productos             | `integration/products/` (4)                                                      |     104 | Catálogo, filtros, escrituras, caché y fallos de avisos posteriores al commit           |
| Cartas                | `integration/cards/` (3)                                                         |      63 | Consultas, asociaciones, ofertas, sincronización real con HTTP externo simulado y Redis |
| Expansiones           | `integration/sets/` (3)                                                          |      30 | Listado, detalle, asociaciones, sincronización y Redis                                  |
| Carrito               | `integration/cart/cart.test.ts`                                                  |      29 | Cantidades, stock, actividad, disponibilidad, propiedad y eliminación                   |
| Direcciones           | `integration/addresses/` (2)                                                     |      41 | CRUD, propiedad, dirección predeterminada y concurrencia                                |
| Pedidos               | `integration/orders/` (6)                                                        |      73 | Checkout, snapshots, pago, cancelación, stock, rollback, concurrencia y Redis           |
| Pedidos vendedor      | `integration/sellerOrders/` (2)                                                  |      24 | Propiedad, privacidad de respuestas, transiciones, entregas e históricos                |
| Estadísticas vendedor | `integration/sellerStats/sellerStats.test.ts`                                    |       7 | Estados, ventas confirmadas, snapshots, mes de creación y mapeo real de fechas          |
| Tiendas públicas      | `integration/stores/stores.test.ts`                                              |       3 | Consultas, ventas confirmadas, agregados y ofertas activas                              |
| Favoritos             | `integration/favorites/` (2)                                                     |      18 | Operaciones implementadas, disponibilidad, propiedad y duplicados concurrentes          |
| Reseñas               | `integration/reviews/` (2)                                                       |      37 | Elegibilidad, CRUD, validación, agregados, paginación y duplicados concurrentes         |
| Notificaciones        | `integration/notifications/` (2)                                                 |      16 | Bandeja, lectura individual/global, contador, eventos y concurrencia                    |
| Administración        | `integration/admin/` (3)                                                         |      26 | Dashboard, usuarios/vendedores, baneo, tiendas, Redis y desactivación frente a pago     |
| Seguridad transversal | `integration/security/engagementAdmin.test.ts`                                   |      22 | Token ausente/inválido, baneo y cambio de rol tras emitir JWT, sin efectos secundarios  |
| Infraestructura Redis | `integration/infrastructure/redis.redis.test.ts`                                 |       2 | Destinos reales, PING y escritura/lectura/borrado de clave exclusiva                    |
| **Total**             | **46 archivos**                                                                  | **641** | **612 integraciones + 29 unitarios**                                                    |

## Catálogo, sincronización y caché

- Filtros individuales/combinados de producto y carta, búsqueda textual con
  `Op.or`, asociaciones, paginación y ordenación se comprueban sobre registros
  distinguibles de PostgreSQL. `optionalAuth` conserva consultas públicas y
  rechaza credenciales inválidas o baneadas.
- Productos y vendedores inactivos se excluyen del listado público. El detalle
  de producto inactivo conserva HTTP 200 con `isActive=false`. Stock cero sigue
  visible en productos, pero no como oferta comprable en el detalle de carta.
- Las expansiones ofrecen listado ordenado y asociaciones, sin filtros ni
  paginación. Las cartas sin ofertas siguen siendo consultables.
- Sync requiere administrador. Se prueban mappers, inserción, actualización,
  idempotencia, errores de conexión, timeout, JSON inválido y errores HTTP 502.
  Solo el lote de cartas garantiza una transacción conjunta: una descarga fallida
  no escribe y un fallo SQL revierte los upserts previos. La sincronización
  individual de carta/expansión usa un upsert atómico.
- Redis real: miss/hit sin SQL adicional, TTL de 300 s, claves independientes,
  fallback a PostgreSQL ante fallos de lectura/escritura e invalidación selectiva
  de ofertas tras producto, perfil vendedor, administración, pago y cancelación.
  Los rollbacks conservan la caché; la invalidación sucede después del commit.
- Producto inexistente devuelve 404; errores internos de producto devuelven 500
  genérico sin detalles SQL. Las pruebas distinguen errores esperados de fallos
  inesperados y no aceptan 500 como validación o conflicto.

## Compra e integridad

- El carrito devuelve cantidades y precios actuales, sin subtotales ni total
  calculados. Artículos inactivos permanecen visibles y eliminables.
- Crear pedido no reserva ni descuenta stock. Guarda snapshots de dirección,
  carta/vendedor, condición, idioma, precio y cantidad; después vacía el carrito.
- Checkout y escrituras del carrito bloquean la fila padre en la misma
  transacción, antes de vendedor y producto. Productos se bloquean en orden
  estable con `FOR UPDATE OF Product`; stock, actividad y snapshots usan esas
  instancias. `findOrCreate` y la restricción única protegen carritos nuevos.
- Pago local, sin pasarela: exige pending, productos/vendedores activos y stock
  suficiente; descuenta una vez, pasa líneas a processing y emite una NEW_SALE
  por vendedor. Cancelar pending no devuelve stock; cancelar paid lo restaura
  una vez. No se cancela con líneas enviadas/entregadas o pedido completado.
- Vendedor: processing → shipped → delivered; todas las líneas entregadas
  completan el pedido. Un perfil comercial inactivo conserva operaciones de
  envío históricas; una cuenta baneada no accede.
- Las respuestas del vendedor excluyen el total global y solo incluyen sus
  líneas. El comprador conserva el pedido completo y su total. Completar sigue
  dependiendo de todas las líneas, independientemente de qué vendedor consulte.
- Ventas de vendedor/tienda: líneas processing/shipped/delivered de pedidos
  paid/completed, usando cantidades y precios históricos. Los contadores de
  estados incluyen canceladas. Las cifras mensuales usan `created_at`, entre el
  inicio del mes local del servidor y el siguiente; recientes devuelve esa fecha.
- Direcciones: todas las escrituras bloquean primero el usuario y después las
  direcciones. Las creaciones concurrentes mantienen una única predeterminada.
  Se conserva que la primera dirección sea predeterminada incluso con false y
  que editar la predeterminada a false pueda dejar ninguna seleccionada.
- Las regresiones conservan doble checkout, cambios de precio/stock durante la
  espera, modificaciones del carrito en ambos órdenes, creación simultánea de
  carrito y competencia por la última unidad, pagos/cancelaciones duplicados,
  carreras de estado y últimas entregas concurrentes.
- Si checkout consume primero, editar/eliminar una línea consumida devuelve 404;
  vaciar sigue siendo idempotente y añadir crea una nueva línea. Si la mutación
  confirma primero, checkout refleja la cantidad o rechaza carrito vacío con 409.
- Los fallos SQL reales verifican rollback completo de pedidos, líneas, stock y
  notificaciones. Las barreras y sus limpiezas se describen en [README.md](./README.md).

## Favoritos, reseñas, notificaciones y administración

Todos los paths siguientes parten de `/api`. Los códigos y formatos comprobados
son los existentes: `{ error }`, validación de reseñas `{ error, details }` y
`{ message }` en notificaciones/administración; autenticación usa `{ error }`.

| Endpoints                                                    | Contrato comprobado                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /favorites; POST/DELETE /favorites/:productId            | Autenticados, propios y ordenados por fecha descendente; alta 201, duplicado 409, baja 204, ausente/ajeno 404, ID inválido 400              |
| GET /products/:productId/reviews                             | Público, página 1/límite 10 por defecto, máximo 50; página por fecha descendente y agregados del producto completo; paginación inválida 400 |
| POST /products/:productId/reviews                            | Autenticado, compra propia completada; 201, no elegible 403, duplicado 409, producto inexistente 404                                        |
| PATCH/DELETE /products/:productId/reviews/:reviewId          | Propietario y pareja producto/reseña correcta; modificación 200, baja 204, ausente/ajena 404                                                |
| GET /notifications; GET /notifications/unread-count          | Autenticados, bandeja propia descendente y `{ count }`; remitente con id/nombre                                                             |
| PATCH /notifications/:id/read; PATCH /notifications/read-all | Lectura propia idempotente, IDs no enteros positivos 400, inexistente/ajena 404; global devuelve `updatedCount`                             |
| GET /admin/access; GET /admin/dashboard                      | Administrador, acceso y contadores/ingresos/actividad reciente                                                                              |
| GET /admin/users; GET /admin/users/:id                       | Administrador, búsqueda por nombre/email, rol, página/límite máximo 100, fecha descendente y detalle con perfil/contadores                  |
| PATCH /admin/users/:id/ban                                   | Administrador, `isBanned` booleano; prohíbe cambiar estado de administradores                                                               |
| PATCH /admin/sellers/:id/status                              | Administrador, `isActive` booleano del perfil, independiente del producto/baneo; repetir estado no produce transición                       |

- Favoritos aceptan productos inactivos/agotados: `inactive` tiene precedencia
  sobre `out_of_stock`. Favoritos/reseñas tienen unicidad usuario/producto y
  borrado en cascada; dos altas concurrentes producen 201/409 y una sola fila.
- Reseñas: rating entero 1–5; comentario recortado hasta 1000 caracteres, omitible
  al crear y nullable al editar. Pending/paid/cancelled no habilitan reseñas.
  Producto/vendedor inactivo permite reseñar una compra completada. Editar no
  revalida la compra. Se comprueban propiedad, privacidad, distribución y promedio.
- Notificaciones sobreviven al borrado de remitente/producto (`SET NULL`). Las
  lecturas concurrentes solo avanzan a leído y no alteran recursos ajenos.
  Dos lecturas globales actualizan 0 y 2 filas; en la secuencia mixta el global
  puede actualizar 1 o 2 según el orden real, siempre con estado final coherente.
- La bandeja HTTP comprueba NEW_SALE, ORDER_CANCELLED, ORDER_SHIPPED,
  ORDER_DELIVERED, favorite_restock y favorite_price_drop, con destinatario y
  contenido correctos. Los avisos de favoritos excluyen al propietario vendedor.
- Los contadores administrativos distinguen roles, perfil activo y producto
  activo. Solo paid/completed generan ingresos confirmados EUR; recientes se
  limitan a 5 y listas de atención a 10 sin truncar totales.
- Tokens ausentes/inválidos reciben 401 y cuentas baneadas/roles insuficientes
  403, sin escrituras no autorizadas. Baneo/desbaneo y desactivación/reactivación
  se comprueban también sobre login, catálogo, favoritos, perfil y compra.
- Desactivar antes de validar vendedor impide pagar con 403 sin descontar stock
  ni NEW_SALE. Si pago ya bloqueó el perfil, el UPDATE administrativo espera el
  commit real, observado mediante `pg_blocking_pids`.

## Limitaciones vigentes

- Si falla `DEL`, la escritura confirma pero la caché puede quedar obsoleta
  hasta su TTL. Las pruebas no prometen coherencia inmediata en ese fallo.
- `userReview` siempre es null en la ruta pública sin autenticación opcional,
  incluso con JWT válido. Se conserva una prueba de ese comportamiento.
- No hay POST público de notificaciones arbitrarias ni listado administrativo
  independiente de vendedores: se usa `/admin/users?role=seller`.
- Listado/detalle administrativo no incluyen `isBanned`. El dashboard hace
  varias consultas y no garantiza un snapshot atómico durante escrituras.
- Los avisos de favoritos se generan tras confirmar el producto, sin garantía
  transaccional de entrega ni reintentos. Si fallan, se registra el error y la
  edición confirmada conserva HTTP 200; se intenta también el otro tipo de aviso.
  Los avisos transaccionales de pedidos siguen provocando rollback ante errores.
- Los meses de ventas corresponden a la creación de las líneas, no al cobro;
  no existe fecha de pago persistida. `orders.*` cuenta líneas y `salesCount` unidades.
- Emails: trim y minúsculas antes de validar/guardar mediante la API. Se buscan
  equivalencias históricas sin reescribir ni fusionar cuentas; más de una
  coincidencia provoca 401 genérico en login, y los conflictos en altas/ediciones
  devuelven 409. La resolución de duplicados históricos queda fuera del login.
  La unicidad normalizada protege las escrituras de la API, sin una nueva
  restricción que cubra escrituras externas que omitan esa política.
