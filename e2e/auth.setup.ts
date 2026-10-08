import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * @description Auth setup for E2E tests.
 * Logs in as admin and saves cookie state to reuse across tests.
 * NOTE: Inputs use Framer Motion with animation delays - wait for complete load.
 */
setup('authenticate as admin', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');

  // Wait for page + animations to fully settle
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // Use getByLabel which is most robust for form inputs
  const emailInput = page.getByLabel('Correo electrónico');
  const passwordInput = page.getByLabel('Contraseña');

  // Wait until inputs are visible and stable
  await expect(emailInput).toBeVisible({ timeout: 15000 });
  await expect(passwordInput).toBeVisible({ timeout: 15000 });

  // Fill credentials
  await emailInput.click();
  await emailInput.fill(process.env.E2E_USER_EMAIL || 'admin@correo.com');
  
  await passwordInput.click();
  await passwordInput.fill(process.env.E2E_USER_PASSWORD || '123456');

  // Verify values were entered
  await expect(emailInput).toHaveValue(process.env.E2E_USER_EMAIL || 'admin@correo.com');

  // Submit Login
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  // Save auth state
  await page.context().storageState({ path: authFile });
});
