import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL || !/^https?:\/\//.test(baseURL)) {
  throw new Error('E2E_BASE_URL explícita requerida.');
}

export default defineConfig({
  testDir: './tests/smoke',
  testMatch: 'production.spec.ts',
  timeout: 30000,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL, ignoreHTTPSErrors: false, trace: 'off', video: 'off' },
});
