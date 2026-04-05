import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Configuración de Vitest para tests de integración de API.
 * Usa entorno node (sin jsdom) y sin el setup de browser globals.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Sin setupFiles de browser (no hay window/ResizeObserver en node)
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})
