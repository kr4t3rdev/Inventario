import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envFile: false,
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['scripts/ci/__tests__/*.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
});