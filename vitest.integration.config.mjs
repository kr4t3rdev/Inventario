/**
 * @description Configuración para tests de integración con DB real.
 *
 * NO es el default (`vitest` corre el config del proyecto). Esta config
 * se ejecuta explícitamente:
 *
 *   DATABASE_URL_TEST=postgresql://localhost:5433/test_db \
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

export default defineConfig({
  test: {
    environment: 'node',
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
