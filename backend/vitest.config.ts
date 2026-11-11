import { defineConfig } from 'vitest/config';
import { loadTestEnvironmentFiles } from './tests/helpers/testEnvironment.js';

loadTestEnvironmentFiles();
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          clearMocks: true,
          restoreMocks: true,
          unstubGlobals: true,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['./tests/globalSetup.ts'],
          setupFiles: ['./tests/setup.ts'],
          fileParallelism: false,
          clearMocks: true,
          restoreMocks: true,
          unstubGlobals: true,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
