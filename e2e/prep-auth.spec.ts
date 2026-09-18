import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * @description Preparación (entorno): inicia sesión vía la API (no por el
 * formulario — el formulario en dev queda bloqueado por la compilación on-demand
 * de /busy:servicios) y guarda el estado de sesión para la prueba GUI.
 */
test('preparar sesión e2e vía API (storageState)', async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL || 'https://kr4t3rdev.xyz',
  });

  const res = await api.post('/api/auth/login', {
    data: { email: 'e2e@test.local', password: 'E2ETest123!' },
  });
  if (res.status() !== 200) {
    throw new Error(`Login API devolvió ${res.status()}: ${await res.text()}`);
  }

  // Recolectar cookies de la respuesta para construir el storageState
  const setCookies = res.headers()['set-cookie'] || '';
  const cookiePairs = setCookies
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean);

  const cookies = cookiePairs.map((pair) => {
    const [nameValue, ...rest] = pair.split('=');
    const isPath = nameValue.toLowerCase() === 'path';
    return {
      name: nameValue,
      value: rest.join('='),
      domain: 'localhost',
      path: isPath ? '/' : '/',
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    };
  });

  // Añadir la cookie de sesión de Next (jwt) desde el header
  const body = await res.json();
  if (!body.user) throw new Error('Respuesta login sin user: ' + JSON.stringify(body));

  const loginPage = await playwright.chromium.launch({ headless: true });
  const context = await loginPage.newContext();
  const page = await context.newPage();
  await page.goto(`${process.env.E2E_BASE_URL || 'https://kr4t3rdev.xyz'}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel(/Correo/i).fill('e2e@test.local');
  await page.locator('input[type="password"]').first().fill('E2ETest123!');
  await page.getByRole('button', { name: /Iniciar/i }).click();
  await page.waitForTimeout(3000);
  await context.storageState({ path: path.join(process.cwd(), 'e2e/.auth/state.json') });
  await loginPage.close();
  await api.dispose();
});

test.afterEach(() => {
  fs.mkdirSync('e2e/.auth', { recursive: true });
});