import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [
      './src/test/setup.ts',
      './src/test/jest-dom-setup.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.kilocode/**',
      '**/.opencode/**',
      '**/.worktrees/**',
      'dist',
      '**/*.spec.ts', // Exclude Playwright E2E tests
      '**/*.spec.tsx',
      '**/*.live.test.ts',
      '**/*.live.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
});
