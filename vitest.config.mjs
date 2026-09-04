import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
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
      include: ['src/**/*.{ts,tsx}'],
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
