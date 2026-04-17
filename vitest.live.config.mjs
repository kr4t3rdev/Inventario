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
    include: [
      'src/**/*.live.test.ts',
      'src/**/*.live.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.kilocode/**',
      '**/.opencode/**',
      'dist',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
});
