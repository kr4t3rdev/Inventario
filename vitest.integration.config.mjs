/**
 * @description Configuración para tests de integración con DB real.
 *
 * NO es el default (`vitest` corre el config del proyecto). Esta config
 * se ejecuta explícitamente:
 *
 *   ALLOW_DISPOSABLE_TEST_DB=1 \
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   DATABASE_URL_TEST=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   pnpm test:integration
 *
 * Ejecuta solo archivos bajo `__integration__` en cualquier parte del repo.
 *
 * @usage
 *   pnpm test:integration                     # corre todos los tests de integración
 *   pnpm test:integration -- my/test.test.ts  # filtra por archivo
 *   DATABASE_URL_TEST=postgres://... pnpm test:integration  (override)
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import { assertDisposableDatabase } from './scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

export default defineConfig({
  envFile: false,
  test: {
    environment: 'node',
    maxWorkers: 1,
    fileParallelism: false,
    globals: true,
    setupFiles: ['./vitest.integration.setup.ts'],
    // Solo tests marcados como de integración.
    include: ['**/__integration__/**/*.test.ts', '**/__integration__/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/.worktrees/**'],
    // Más tiempo para operaciones contra una DB real.
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      'server-only': path.resolve(process.cwd(), './src/test/__mocks__/server-only.ts'),
    },
  },
});
