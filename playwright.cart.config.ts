import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = (process.env.E2E_BASE_URL || 'https://kr4t3rdev.xyz').replace(/\/$/, '');
const STORAGE = path.join(process.cwd(), 'e2e', '.auth', 'user.json');

/**
 * @description Config para E2E contra el host de producción (Railway).
 * Uso: pnpm run test:e2e:prod  (o E2E_BASE_URL=https://... para otro host).
 * El storageState lo genera e2e/prep-auth.spec.ts a partir del login por API.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/auth.setup.ts', '**/global-setup.ts'],
  timeout: 120000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE,
    trace: 'off',
    screenshot: 'on',
    video: 'off',
    navigationTimeout: 60000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});