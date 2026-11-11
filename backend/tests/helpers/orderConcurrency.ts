import { setImmediate } from 'node:timers/promises';
import { QueryTypes } from 'sequelize';
import type { Response, Test } from 'supertest';
import sequelize from './testDatabase.js';
import { assertSafeTestDatabase } from './testDatabaseControl.js';

type LockTable = 'orders' | 'products' | 'seller_profiles' | 'users' | 'carts';
interface PgConnection {
  processID: number;
  query(sql: string): Promise<unknown>;
}
interface Gate {
  start(request: Test): Promise<PromiseSettledResult<Response>>;
  waitForBlocked(
    count: number,
    untilSettled?: Promise<PromiseSettledResult<Response>>,
  ): Promise<'blocked' | 'settled'>;
  changeProduct(values: { stock?: number; price?: number }): Promise<void>;
}

// Keep the blocker, two HTTP transactions and the observer within the existing pool.
// Every PostgreSQL timeout is LOCAL to a transaction; pooled sessions are not reconfigured.
export const withOrderRowLock = async (
  table: LockTable,
  id: number,
  exercise: (gate: Gate) => Promise<void>,
): Promise<Response[]> => {
  await assertSafeTestDatabase(sequelize);
  const blocker = await sequelize.transaction();
  const jobs: Promise<PromiseSettledResult<Response>>[] = [];
  const transactions = new WeakSet<object>();
  const sessions = new Set<number>();
  const hookName = 'test-local-http-timeouts';
  let blockerPid = 0;
  let results: PromiseSettledResult<Response>[];
  let cleanupError: Error | undefined;

  sequelize.addHook('beforeQuery', hookName, async (options, query) => {
    if (!options.transaction || !query.model || transactions.has(options.transaction)) return;
    transactions.add(options.transaction);
    const connection = query.connection as PgConnection;
    if (typeof connection.query !== 'function' || !Number.isInteger(connection.processID))
      throw new Error('Expected a PostgreSQL connection');
    sessions.add(connection.processID);
    // Native pg SQL avoids recursively invoking this observation hook. No query is replaced.
    await connection.query(
      "SET LOCAL application_name = 'pokemarket-test-http'; SET LOCAL lock_timeout = '4s'; SET LOCAL statement_timeout = '6s'; SET LOCAL idle_in_transaction_session_timeout = '10s'",
    );
  });

  try {
    await sequelize.query(
      "SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '3s'; SET LOCAL idle_in_transaction_session_timeout = '10s'",
      { transaction: blocker },
    );
    const [pid] = await sequelize.query<{ pid: number }>('SELECT pg_backend_pid() AS pid', {
      transaction: blocker,
      type: QueryTypes.SELECT,
    });
    blockerPid = pid.pid;
    // table is a closed union, never user input; IDs are bound values.
    const rows = await sequelize.query<{ id: number }>(
      `SELECT id FROM public.${table} WHERE id = :id FOR UPDATE`,
      { replacements: { id }, transaction: blocker, type: QueryTypes.SELECT },
    );
    if (rows.length !== 1) throw new Error('Cannot lock a missing testing row');
    await exercise({
      start(req) {
        // Immediately observe both fulfillment and rejection to avoid unhandled rejections.
        const job = req.timeout({ response: 8_000, deadline: 9_000 }).then(
          (value): PromiseFulfilledResult<Response> => ({ status: 'fulfilled', value }),
          (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
        );
        jobs.push(job);
        return job;
      },
      async waitForBlocked(count, untilSettled) {
        let settled = false;
        void untilSettled?.then(() => {
          settled = true;
        });
        const deadline = performance.now() + 2_500;
        do {
          const blocked = await sequelize.query<{ pid: number }>(
            `
            WITH RECURSIVE waiters AS (
              SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
              WHERE datname = current_database()
            ), chain(pid) AS (
              SELECT pid FROM waiters WHERE :root = ANY(blockers)
              UNION
              SELECT w.pid FROM waiters w JOIN chain c ON c.pid = ANY(w.blockers)
            ) SELECT DISTINCT pid FROM chain`,
            { replacements: { root: blockerPid }, type: QueryTypes.SELECT },
          );
          if (blocked.filter((row) => sessions.has(row.pid)).length >= count) return 'blocked';
          if (settled) return 'settled';
          await setImmediate();
        } while (performance.now() < deadline);
        throw new Error(`Expected ${count} HTTP transactions blocked by the test row`);
      },
      async changeProduct(values) {
        if (table !== 'products') throw new Error('Product changes require the product blocker');
        if (values.stock !== undefined)
          await sequelize.query('UPDATE public.products SET stock = :stock WHERE id = :id', {
            replacements: { id, stock: values.stock },
            transaction: blocker,
          });
        if (values.price !== undefined)
          await sequelize.query('UPDATE public.products SET price = :price WHERE id = :id', {
            replacements: { id, price: values.price },
            transaction: blocker,
          });
      },
    });
    await blocker.commit();
  } finally {
    try {
      // A commit/rollback marks a Sequelize transaction finished, including commit failures.
      if (!(blocker as unknown as { finished?: string }).finished) await blocker.rollback();
    } finally {
      try {
        results = await Promise.all(jobs);
        // HTTP deadlines alone do not cancel SQL. Cancel any remaining test-tagged backend,
        // then wait for the service to roll back before the shared cleanup can run.
        const deadline = performance.now() + 3_000;
        while (sessions.size > 0) {
          const active = await sequelize.query<{ pid: number }>(
            "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'pokemarket-test-http' AND pid IN (:pids)",
            { replacements: { pids: [...sessions] }, type: QueryTypes.SELECT },
          );
          if (active.length === 0) break;
          for (const { pid } of active)
            await sequelize.query('SELECT pg_cancel_backend(:pid)', {
              replacements: { pid },
              type: QueryTypes.SELECT,
            });
          if (performance.now() >= deadline) {
            // Only sessions collected from this test and still carrying its LOCAL tag qualify.
            await sequelize.query(
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'pokemarket-test-http' AND datname = current_database() AND pid IN (:pids)",
              { replacements: { pids: [...sessions] }, type: QueryTypes.SELECT },
            );
            cleanupError = new Error(
              'Concurrency cleanup had to terminate a stuck testing transaction',
            );
            break;
          }
          await setImmediate();
        }
      } finally {
        sequelize.removeHook('beforeQuery', hookName);
      }
    }
  }
  if (cleanupError) throw cleanupError;
  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length > 0)
    throw new AggregateError(
      rejected.map((result) => result.reason),
      'Concurrent HTTP requests failed',
    );
  return results.map((result) => (result as PromiseFulfilledResult<Response>).value);
};
