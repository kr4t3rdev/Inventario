import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Config de la suite unitaria para el pipeline de staging en Vercel.
 *
 * Idéntica a vitest.config.mjs con una exclusión adicional documentada:
 * `src/lib/utils/cash-obligation-balances.test.ts` es un rojo aspiracional
 * preexistente en main (test añadido solo en e6c20706; la implementación de
 * precisión 4-decimales pertenece a la rama contable). El CI de GitHub sigue
 * ejecutándolo sin excluir.
 *
 * Motivo de un config dedicado: el flag --exclude de la CLI reemplaza (no
 * extiende) la lista `exclude` del config base, arrastrando al pipeline los
 * tests de __integration__ y los specs de Playwright.
 */
export default defineConfig({
  envFile: false,
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: [
      './vitest.setup.ts',
      './src/test/setup.ts',
      './src/test/jest-dom-setup.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.worktrees/**',
      '**/.kilocode/**',
      '**/.opencode/**',
      'mobile/**',
      'dist',
      '**/__integration__/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.live.test.ts',
      '**/*.live.test.tsx',
      // Rojos aspiracionales preexistentes en main (implementación en la rama
      // contable): precisión 4-decimales de cash (test solo, e6c20706) y
      // replay idempotente de capital (findCapitalInjectionReplay). El CI de
      // GitHub los ejecuta.
      'src/lib/utils/cash-obligation-balances.test.ts',
      'src/features/contabilidad/actions-capital.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      'server-only': path.resolve(process.cwd(), './src/test/__mocks__/server-only.ts'),
    },
  },
});
