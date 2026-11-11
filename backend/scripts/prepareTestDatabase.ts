import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertTestEnvironment,
  loadTestEnvironmentFiles,
  projectRoot,
} from '../tests/helpers/testEnvironment.js';
import {
  acquireTestDatabaseLock,
  assertCleanupForeignKeys,
  assertMigrationsApplied,
} from '../tests/helpers/testDatabaseControl.js';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Only --check is supported; database/config overrides are not allowed');
}
loadTestEnvironmentFiles();
process.env.NODE_ENV = 'test';
assertTestEnvironment();
const { default: sequelize } = await import('../src/config/database.js');
let lock: Awaited<ReturnType<typeof acquireTestDatabaseLock>> | undefined;

try {
  lock = await acquireTestDatabaseLock(sequelize);
  if (!args.includes('--check')) {
    const cli = fileURLToPath(
      new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url),
    );
    const config = fileURLToPath(new URL('../config/config.js', import.meta.url));
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [cli, 'db:migrate', '--env', 'test', '--config', config],
        {
          cwd: projectRoot,
          env: { ...process.env, NODE_ENV: 'test' },
          stdio: 'inherit',
        },
      );
      child.once('error', () => reject(new Error('Unable to start Sequelize CLI')));
      child.once('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Test migrations failed'));
      });
    });
  }
  await assertMigrationsApplied(sequelize);
  await assertCleanupForeignKeys(sequelize);
  console.log('Test database verified; no databases were created or deleted');
} catch (error) {
  console.error(
    error instanceof Error && !error.name.startsWith('Sequelize')
      ? error.message
      : 'Unable to verify the test database; check PostgreSQL connectivity',
  );
  process.exitCode = 1;
} finally {
  try {
    await lock?.rollback();
  } finally {
    await sequelize.close();
  }
}
