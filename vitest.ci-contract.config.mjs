import { defineConfig } from 'vitest/config';

export default defineConfig({
  envFile: false,
  test: {
    environment: 'node',
    include: ['scripts/ci/__tests__/*.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
