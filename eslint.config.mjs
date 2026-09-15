import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Scripts utilitarios (bench/ops Playwright) usan @ts-nocheck a propósito:
    // son tooling desechable con tipos sueltos, no código de aplicación.
    files: ['scripts/**'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    files: ['src/features/contabilidad/components/prestamos-cash/prestamos-cash-table.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'prefer-const': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'node_modules/**',
    'next-env.d.ts',
    'src/generated/**',
    // Script de benchmark local corrupto (header: "no va al repo"); no debe lintearse.
    'scripts/bench-contabilidad.js',
    '.kilocode/**',
    '.opencode/**',
    '.worktrees/**',
  ]),
]);

export default eslintConfig;
