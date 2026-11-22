import { test, expect, type Playwright } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * E2E de la inicialización de cuentas (tramo 2 de la tarea 7):
 * página de cuentas → diálogo → borrador → retomar → revisar → confirmar.
 *
 * Requisitos del entorno (corrida local contra el dev server):
 * - globalSetup siembra un tenant nuevo en la base desechable y escribe
 *   test-results/e2e-fixture-ownership.json con el email del usuario E2E.
 * - E2E_TEST_PASSWORD con la contraseña de ese usuario (la misma del seed).
 * - El dev server corre con DATABASE_URL apuntando a la misma base desechable.
 * - El tenant es nuevo en cada corrida: la inicialización solo se puede
 *   confirmar una vez por tenant, así que este spec no admite reintento.
 * - El login va dentro del test (no en beforeAll): el primer login compila
 *   la ruta bajo demanda y supera el timeout de 30 s de los hooks.
 */

type SessionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
};

async function loginViaApi(playwright: Playwright): Promise<SessionCookie[]> {
  const manifestPath = path.join(process.cwd(), 'test-results/e2e-fixture-ownership.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Falta test-results/e2e-fixture-ownership.json — corre con el globalSetup (pnpm run test:e2e).');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  // El tenant de inicialización está vacío: el tenant principal del seed trae
  // una Caja E2E y la acción rechazaría con INITIALIZATION_NOT_EMPTY.
  const initEmail = manifest.initTenant?.email as string | undefined;
  if (!initEmail) {
    throw new Error('El manifiesto no trae initTenant.email — el seed E2E no sembró el tenant vacío.');
  }
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) throw new Error('Falta E2E_TEST_PASSWORD (la misma contraseña del seed E2E).');

  const api = await playwright.request.newContext({ baseURL: 'http://localhost:3001' });
  try {
    const res = await api.post('/api/auth/login', {
      data: { email: initEmail, password },
    });
    if (res.status() !== 200) {
      throw new Error(`Login API devolvió ${res.status()}: ${await res.text()}`);
    }
    const setCookies = res.headers()['set-cookie'] || '';
    const cookiePairs = setCookies
      .split(/,(?=\s*\w+=)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean);
    const cookies: SessionCookie[] = cookiePairs.map((pair) => {
      const [nameValue, ...rest] = pair.split('=');
      return {
        name: nameValue,
        value: rest.join('='),
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      };
    });
    if (cookies.length === 0) throw new Error('El login no devolvió cookies de sesión.');
    return cookies;
  } finally {
    await api.dispose();
  }
}

test.describe('Inicialización de cuentas (E2E local)', () => {
  test.setTimeout(600_000);

  test('borrador, retomar, revisar y confirmar una cuenta inicial', async ({ page, context, playwright }) => {
    const sessionCookies = await loginViaApi(playwright);
    await context.addCookies(sessionCookies);
    // Primera carga: la compilación bajo demanda de /busy tarda minutos en esta Mac.
    await page.goto('/busy/contabilidad/cuentas', { timeout: 300_000 });
    await expect(page.getByRole('heading', { name: 'Cuentas Bancarias' })).toBeVisible();

    const numeroCuenta = `E2E-${Date.now().toString().slice(-6)}`;
    await page.getByRole('button', { name: 'Cargar saldos iniciales' }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByRole('heading', { name: 'Configurar cuentas bancarias' })).toBeVisible();

    const fields = dialog.getByRole('textbox');
    await fields.nth(0).fill('Cuenta E2E');
    await fields.nth(1).fill('Banco E2E');
    await fields.nth(2).fill(numeroCuenta);
    await fields.nth(3).fill('1000');

    const selects = dialog.getByRole('combobox');
    await selects.nth(2).click();
    await page.getByRole('option', { name: 'No documentada' }).click();

    await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Borrador guardado')).toBeVisible({ timeout: 15_000 });

    // Retomar: recargar y volver a abrir el diálogo.
    await page.reload({ timeout: 120_000 });
    await expect(page.getByRole('heading', { name: 'Cuentas Bancarias' })).toBeVisible();
    await page.getByRole('button', { name: 'Cargar saldos iniciales' }).click();
    await expect(dialog.getByText(/Borrador retomado/)).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('textbox').nth(0)).toHaveValue('Cuenta E2E');

    await dialog.getByRole('button', { name: 'Revisar y confirmar' }).click();
    await expect(dialog.getByText(/Total funcional: 1000 CUP/)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Inicializar empresa' }).click();
    await expect(page.getByText('Cuentas inicializadas')).toBeVisible({ timeout: 15_000 });

    // La cuenta inicializada aparece en la lista de la página.
    await page.reload({ timeout: 120_000 });
    await expect(page.getByText('Cuenta E2E')).toBeVisible({ timeout: 15_000 });
  });
});
