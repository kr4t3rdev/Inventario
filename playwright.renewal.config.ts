import { defineConfig, devices } from '@playwright/test';

/**
 * @description Config dedicado para el E2E local del flujo "Renovar licencia"
 * contra el dev server propio con DB desechable (tcp_test_local).
 *
 * Difiere de playwright.config.ts en dos puntos:
 * - SIN globalSetup: el seeder global de usuario E2E no es necesario (el
 *   spec siembra su propio admin + licencia) y su carga local falla por un
 *   issue de interoperabilidad ESM/CJS preexistente.
 * - SIN webServer: el dev server se levanta manualmente (p. ej. con nohup)
 *   porque el healthcheck del config general golpea la ruta raíz "/" que
 *   no existe en esta app y expira siempre a los 120s.
 *
 * @usage
 *   # terminal 1: dev server
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *     PORT=3001 pnpm run dev
 *   # terminal 2: tests
 *   E2E_TEST_PASSWORD='E2ERenewAdmin123!pass' \
 *     npx playwright test --config playwright.renewal.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/admin-licencias-renew.spec.ts',
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
