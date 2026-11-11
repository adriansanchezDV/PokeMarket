# Testing de PokéMarket

Vitest ejecuta dos proyectos separados: `unit` y `integration`. La cobertura y las
limitaciones actuales están en [COVERAGE.md](./COVERAGE.md).

## Entorno y comandos

Crear localmente `.env.test` con las credenciales del destino de testing. Ejemplo
orientativo; sustituir los marcadores, sin copiar secretos de otros entornos:

```dotenv
TEST_DB_NAME=pokemarket_test
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=<usuario-de-testing>
DB_PASSWORD=<password-de-testing>
JWT_SECRET=<secreto-exclusivo-de-testing>
TEST_REDIS_URL=redis://127.0.0.1:6380/0
```

Las variables del proceso tienen prioridad sobre `.env.test`, y esta sobre `.env`.
La configuración establece `NODE_ENV=test` antes de importar la aplicación.
`DB_NAME`, si está definida, debe ser distinta de `TEST_DB_NAME`. No se crean ni
eliminan bases: `pokemarket_test` debe existir previamente.

```sh
npm run test:check
npm run test:unit
npm run test:integration
npm test
npm run test:watch
npm run typecheck
npm run typecheck:tests
npm run lint
```

En PowerShell puede utilizarse `npm.cmd` si la política bloquea `npm.ps1`.
Para ejecutar un módulo: `npm run test:integration -- tests/integration/reviews`.
Para reproducir un orden aleatorio puede pasarse `--sequence.shuffle` y la semilla
de la ejecución a Vitest; no hay una semilla fija en la configuración.

Si el esquema necesita preparación, ejecutar **explícitamente** `npm run test:prepare`.
Aplica migraciones pendientes mediante Sequelize CLI con `--env test`; no admite
argumentos que sustituyan el destino o la configuración. `test:check` verifica sin
migrar y la suite nunca aplica migraciones automáticamente.

## Organización y ciclo de vida

- `unit/`: pruebas aisladas, sin conexiones PostgreSQL/Redis ni setup de integración.
- `integration/`: Supertest, Express, servicios y Sequelize reales; archivos por módulo.
- `factories/`: creación tipada de registros y asociaciones válidas.
- `fixtures/tcgdex/`: respuestas externas representativas.
- `helpers/`: entorno, seguridad de limpieza, preparación de compras y barreras.
- `globalSetup.ts`: comprobación del esquema y bloqueo exclusivo de la base.
- `setup.ts`: conexión, limpieza, resets entre casos y cierre por archivo.

No se ejecutan archivos en paralelo. Un bloqueo asesor PostgreSQL impide ejecutar
otra suite o preparar migraciones simultáneamente sobre la misma base. Watch
mantiene el bloqueo hasta salir. Cada petición usa las transacciones reales de
la aplicación: no hay una transacción exterior por test.

Antes de limpiar se comprueban `NODE_ENV`, `TEST_DB_NAME`, la instancia Sequelize,
`current_database()` y el grafo real de claves foráneas. Las raíces `users` y `sets`
alcanzan las 13 tablas de aplicación, incluidas referencias `SET NULL`. Se rechaza
cualquier alcance inesperado y se conserva `SequelizeMeta`. Al añadir tablas o
migraciones debe revisarse la lista de seguridad; no usar `sync({ force: true })`.

Se restauran spies/globals, limitadores y secuencias de factories entre casos.
No repetir hooks de conexión, limpieza o cierre en los módulos.

## Dependencias externas

Solo los archivos `*.redis.test.ts` conectan al cliente Redis real y necesitan
`TEST_REDIS_URL` explícita. El setup selecciona el destino antes de importar la
aplicación y rechaza reutilizar el servidor/base habituales, incluso con otras
credenciales o variantes de loopback. Los demás archivos mantienen el cliente
desconectado y apuntado a un destino inerte. Los unitarios no necesitan Redis.

La limpieza Redis usa `SCAN` y `DEL` solo para `cards:list:*`, `cards:detail:*`,
`sets:list` y `sets:detail:*`. Nunca `FLUSHALL` ni `FLUSHDB`. La prueba de
infraestructura usa una clave `pokemarket:test:infrastructure:*`, TTL breve y
eliminación en `finally`. No conectar Redis manualmente desde otros casos.

El contenedor `pokemarket-redis-test` debe estar disponible para estas pruebas.
Se recomienda un usuario PostgreSQL y un destino Redis exclusivos de testing:
comparar URLs no permite detectar todos los alias DNS de un mismo servidor.

El `fetch` externo está bloqueado por defecto. `helpers/tcgdexHttp.ts` proporciona
respuestas de `fixtures/tcgdex/catalog.ts` y rechaza URLs no previstas, sin Internet.
El timeout de TCGdex se verifica mediante la señal de aborto y su valor de
10 000 ms, sin esperar ese intervalo ni alterar el reloj HTTP.

No se simulan servicios internos, modelos, mappers ni consultas. Para probar
fallos de transporte se permite interceptar un comando Redis o la adquisición
de conexión PostgreSQL. Los spies restantes observan la implementación real.
Mantener visibles los logs de casos negativos.

## Preparación de datos y fallos controlados

`createUser` y `createToken` están en `helpers/userTestHelpers.ts`. La contraseña
por defecto es `Password123`; un override en texto plano se cifra. Los emails
usan una secuencia reiniciada entre casos y los tokens admiten `expiresIn`.
La factory de vendedor crea usuario y perfil; la de producto reutiliza cartas y
expansiones, o acepta `cardId`/`sellerProfileId`. Los identificadores TCGdex son
secuenciales y se reinician. Las factories preparan datos, no reemplazan los
comportamientos HTTP que se prueban.

`helpers/purchase.ts` prepara checkouts y alcanza el pago por HTTP real;
`reviewPurchase.ts` reutiliza esos flujos para llegar a compra completada.
Las factories de pedidos/líneas permiten preparar estados para consultas y
validaciones que no necesitan recorrer todo el flujo.

`transactionFailure.ts` instala hooks nombrados que ejecutan `SELECT 1 / 0`
dentro de la transacción real después de escrituras, capturando su ID y contadores.
`orderConcurrency.ts` bloquea filas y observa `pg_blocking_pids`, sin sleeps fijos.
Usa límites PostgreSQL LOCAL para las peticiones: lock 4 s, statement 6 s e idle
10 s; barrera de 2,5 s, deadline HTTP de 9 s y casos de 15 s. La transacción
bloqueadora tiene sus propios límites menores de lock/statement.

La limpieza libera la transacción, espera peticiones y retira hooks en `finally`.
PID y etiqueta LOCAL `pokemarket-test-http` identifican exclusivamente sesiones
propias: se cancela SQL residual y solo como último recurso se termina una sesión,
haciendo fallar la prueba. Se comprueban ausencia de sesiones y bloqueo `NOWAIT`.
Las barreras de duplicados y notificaciones también liberan esperas, cancelan
temporizadores y esperan todas las peticiones aunque falle una aserción.
