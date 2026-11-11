import type { Response, Test } from 'supertest';
import type { Model, ModelStatic } from 'sequelize';

// Both requests finish their real preflight reads before either real INSERT proceeds.
export const concurrentCreates = async (
  model: ModelStatic<Model>,
  requests: Test[],
): Promise<Response[]> => {
  let arrived = 0;
  let ready!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const name = 'test-concurrent-inserts';
  model.addHook('beforeCreate', name, async () => {
    if (++arrived === requests.length) ready();
    await gate;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const jobs = requests.map((req) =>
    req.timeout({ response: 8_000, deadline: 9_000 }).then(
      (value): PromiseFulfilledResult<Response> => ({ status: 'fulfilled', value }),
      (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
    ),
  );
  let results: PromiseSettledResult<Response>[];
  try {
    await Promise.race([
      waiting,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Both requests did not reach the INSERT boundary')),
          2_500,
        );
      }),
    ]);
  } finally {
    release();
    if (timer) clearTimeout(timer);
    try {
      results = await Promise.all(jobs);
    } finally {
      model.removeHook('beforeCreate', name);
    }
  }
  const errors = results.filter((r) => r.status === 'rejected');
  if (errors.length)
    throw new AggregateError(
      errors.map((r) => r.reason),
      'Concurrent HTTP failure',
    );
  return results.map((r) => (r as PromiseFulfilledResult<Response>).value);
};
