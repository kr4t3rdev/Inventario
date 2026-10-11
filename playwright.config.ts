import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // El spec de renovación siembra/borra fixtures crudas: solo corre con el
  // config dedicado (playwright.renewal.config.ts) + ALLOW_DISPOSABLE_TEST_DB=1
  testIgnore: ['**/auth.setup.ts', '**/global-setup.ts', '**/admin-licencias-renew.spec.ts'],
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'PORT=3001 pnpm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120000
  }
});
