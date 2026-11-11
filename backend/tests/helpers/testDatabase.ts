import sequelize, { assertTestDatabase } from '../../src/config/database.js';
import { assertCleanupForeignKeys, assertSafeTestDatabase } from './testDatabaseControl.js';

assertTestDatabase(sequelize.getDatabaseName());

export const cleanTestDatabase = async () => {
  assertTestDatabase(sequelize.getDatabaseName());
  await assertSafeTestDatabase(sequelize);
  await assertCleanupForeignKeys(sequelize);

  await sequelize.query(`
    DO $$
    BEGIN
      IF current_database() IS DISTINCT FROM 'pokemarket_test' THEN
        RAISE EXCEPTION 'Test cleanup refused: unexpected database';
      END IF;

      TRUNCATE TABLE public.users, public.sets RESTART IDENTITY CASCADE;
    END;
    $$;
  `);
};

export default sequelize;
