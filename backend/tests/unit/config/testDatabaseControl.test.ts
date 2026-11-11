import { describe, expect, it, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { createClient } from 'redis';
import { cleanTestRedis } from '../../helpers/testRedis.js';
import {
  applicationTables,
  assertExpectedCleanupTables,
  assertSafeTestDatabase,
} from '../../helpers/testDatabaseControl.js';

describe('Database cleanup safeguards', () => {
  it('rejects a Sequelize instance pointing at development before querying', async () => {
    const database = new Sequelize({ dialect: 'postgres', database: 'pokemarket', logging: false });
    const query = vi.spyOn(database, 'query');
    try {
      await expect(
        assertSafeTestDatabase(database, {
          NODE_ENV: 'test',
          TEST_DB_NAME: 'pokemarket_test',
          DB_NAME: 'pokemarket',
        }),
      ).rejects.toThrow('Sequelize instance');
      expect(query).not.toHaveBeenCalled();
    } finally {
      await database.close();
    }
  });
  it('accepts exactly the reviewed application tables', () => {
    expect(() =>
      assertExpectedCleanupTables(applicationTables.map((name) => ({ schema: 'public', name }))),
    ).not.toThrow();
  });
  it('refuses a cascade reaching migration metadata or unrelated tables', () => {
    const tables = applicationTables.map((name) => ({ schema: 'public', name: String(name) }));
    expect(() =>
      assertExpectedCleanupTables([...tables, { schema: 'public', name: 'SequelizeMeta' }]),
    ).toThrow();
  });
  it('refuses a missing catalogue dependency', () => {
    expect(() =>
      assertExpectedCleanupTables(
        applicationTables
          .filter((name) => name !== 'cards')
          .map((name) => ({ schema: 'public', name })),
      ),
    ).toThrow();
  });
  it('refuses cross-schema tables with the same names', () => {
    expect(() =>
      assertExpectedCleanupTables(
        applicationTables.map((name) => ({ schema: name === 'cards' ? 'other' : 'public', name })),
      ),
    ).toThrow();
  });
});

describe('Redis cleanup safeguards', () => {
  it('rejects a development destination even when environment and client URLs all match', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('TEST_DB_NAME', 'pokemarket_test');
    vi.stubEnv('DB_NAME', 'pokemarket');
    vi.stubEnv('TEST_REDIS_URL', 'redis://localhost:6379/0');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379/0');
    const client = createClient({ url: 'redis://localhost:6379/0' });
    const scan = vi.spyOn(client, 'scanIterator');
    try {
      await expect(cleanTestRedis(client)).rejects.toThrow('different server or Redis database');
      expect(scan).not.toHaveBeenCalled();
      expect(client.isOpen).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('rejects the actual development client even when test environment variables are set', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('TEST_DB_NAME', 'pokemarket_test');
    vi.stubEnv('DB_NAME', 'pokemarket');
    vi.stubEnv('TEST_REDIS_URL', 'redis://localhost:6379/1');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379/1');
    const client = createClient({ url: 'redis://localhost:6379/0' });
    const scan = vi.spyOn(client, 'scanIterator');
    try {
      await expect(cleanTestRedis(client)).rejects.toThrow('Refusing Redis cleanup');
      expect(scan).not.toHaveBeenCalled();
      expect(client.isOpen).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
