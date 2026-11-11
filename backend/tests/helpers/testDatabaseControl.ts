import { readdir } from 'node:fs/promises';
import { QueryTypes, type Sequelize } from 'sequelize';
import { assertTestEnvironment, projectRoot, testDatabaseName } from './testEnvironment.js';

export const applicationTables = [
  'users',
  'sets',
  'seller_profiles',
  'cards',
  'products',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'favorites',
  'reviews',
  'shipping_addresses',
  'notifications',
] as const;

export const assertSafeTestDatabase = async (
  sequelize: Sequelize,
  environment: NodeJS.ProcessEnv = process.env,
) => {
  assertTestEnvironment(environment);
  if (sequelize.getDatabaseName() !== testDatabaseName) {
    throw new Error('The Sequelize instance does not target the test database');
  }
  const [row] = await sequelize.query<{ database: string }>(
    'SELECT current_database() AS database',
    { type: QueryTypes.SELECT },
  );
  if (row?.database !== testDatabaseName) {
    throw new Error('The PostgreSQL connection does not target the test database');
  }
};

export const acquireTestDatabaseLock = async (sequelize: Sequelize) => {
  await assertSafeTestDatabase(sequelize);
  const transaction = await sequelize.transaction();
  try {
    const [row] = await sequelize.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtext('pokemarket:test-suite')) AS locked",
      { type: QueryTypes.SELECT, transaction },
    );
    if (!row?.locked) throw new Error('Another test run or test preparation is already active');
    return transaction;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const assertMigrationsApplied = async (sequelize: Sequelize) => {
  await assertSafeTestDatabase(sequelize);
  const [table] = await sequelize.query<{ name: string | null }>(
    `SELECT to_regclass('public."SequelizeMeta"')::text AS name`,
    { type: QueryTypes.SELECT },
  );
  if (!table?.name) throw new Error('Test schema is not prepared. Run npm run test:prepare');
  const applied = await sequelize.query<{ name: string }>(
    'SELECT name FROM "public"."SequelizeMeta"',
    { type: QueryTypes.SELECT },
  );
  const files = (await readdir(projectRoot + 'migrations')).filter((name) => name.endsWith('.js'));
  const known = new Set(files);
  const executed = new Set(applied.map((migration) => migration.name));
  if (files.some((name) => !executed.has(name)) || applied.some(({ name }) => !known.has(name))) {
    throw new Error('Test migrations do not match the repository. Run npm run test:prepare');
  }
};

export const assertExpectedCleanupTables = (tables: { schema: string; name: string }[]) => {
  const expected = new Set<string>(applicationTables);
  if (
    tables.length !== expected.size ||
    tables.some((table) => table.schema !== 'public' || !expected.has(table.name)) ||
    new Set(tables.map((table) => table.name)).size !== expected.size
  ) {
    throw new Error('Unexpected foreign-key graph: refusing to truncate test tables');
  }
};

export const assertCleanupForeignKeys = async (sequelize: Sequelize) => {
  const tables = await sequelize.query<{ schema: string; name: string }>(
    `
    WITH RECURSIVE affected(oid) AS (
      SELECT oid FROM pg_class
      WHERE oid IN (to_regclass('public.users'), to_regclass('public.sets'))
      UNION
      SELECT fk.conrelid FROM pg_constraint fk JOIN affected a ON fk.confrelid = a.oid
      WHERE fk.contype = 'f'
    )
    SELECT n.nspname AS schema, c.relname AS name FROM affected a
    JOIN pg_class c ON c.oid = a.oid JOIN pg_namespace n ON n.oid = c.relnamespace
  `,
    { type: QueryTypes.SELECT },
  );
  assertExpectedCleanupTables(tables);
};
