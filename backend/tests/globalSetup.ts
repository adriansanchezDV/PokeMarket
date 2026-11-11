import { loadTestEnvironmentFiles, assertTestEnvironment } from './helpers/testEnvironment.js';
import {
  acquireTestDatabaseLock,
  assertCleanupForeignKeys,
  assertMigrationsApplied,
} from './helpers/testDatabaseControl.js';

export default async function setup() {
  loadTestEnvironmentFiles();
  assertTestEnvironment();
  const { default: sequelize } = await import('../src/config/database.js');
  let lock: Awaited<ReturnType<typeof acquireTestDatabaseLock>> | undefined;
  try {
    lock = await acquireTestDatabaseLock(sequelize);
    await assertMigrationsApplied(sequelize);
    await assertCleanupForeignKeys(sequelize);
  } catch (error) {
    try {
      if (lock) await lock.rollback();
    } finally {
      await sequelize.close();
    }
    throw error;
  }
  return async () => {
    try {
      const { cleanTestDatabase } = await import('./helpers/testDatabase.js');
      await cleanTestDatabase();
    } finally {
      try {
        await lock?.rollback();
      } finally {
        await sequelize.close();
      }
    }
  };
}
