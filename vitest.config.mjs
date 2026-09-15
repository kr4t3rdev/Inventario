import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  envFile: false,
  test: {
    environment: 'jsdom',
    globals: true,
    // Los componentes jsdom pesados (la suite completa corre en paralelo en CI)
    // tardan ~6-7 s; sin este margen caen en el timeout por defecto de 5 s.
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: [
      './vitest.setup.ts',
      './src/test/setup.ts',
      './src/test/jest-dom-setup.ts',
    ],
    // Los tests de integración real (contra DB de test) viven en __integration__
    // y usan vitest.integration.config.mjs con DATABASE_URL_TEST.
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.worktrees/**',
      '**/.kilocode/**',
      '**/.opencode/**',
      'mobile/**',
      'dist',
      '**/__integration__/**',
      '**/*.spec.ts', // Exclude Playwright E2E tests
      '**/*.spec.tsx',
      '**/*.live.test.ts',
      '**/*.live.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: process.env.CI_COVERAGE_MERGE === '1' ? {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      } : undefined,
      // El umbral global representa código de dominio y backend con pruebas
      // unitarias deterministas. Las páginas Next y los componentes de
      // composición se validan en sus suites de UI/E2E, no con instrumentación
      // V8 que los marcaría como código ejecutable no invocado.
      include: [
        'src/lib/api/**/*.{ts,tsx}',
        'src/lib/auth/**/*.{ts,tsx}',
        'src/lib/constants/**/*.{ts,tsx}',
        'src/lib/db/**/*.{ts,tsx}',
        'src/lib/openapi/**/*.{ts,tsx}',
        'src/lib/seo/**/*.{ts,tsx}',
        'src/lib/server-actions/**/*.{ts,tsx}',
        'src/lib/types/**/*.{ts,tsx}',
        'src/features/contabilidad/domain/**/*.{ts,tsx}',
        'src/features/contabilidad/lib/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/generated/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      'server-only': path.resolve(process.cwd(), './src/test/__mocks__/server-only.ts'),
    },
  },
});
