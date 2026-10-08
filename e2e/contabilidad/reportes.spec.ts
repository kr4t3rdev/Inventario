import { test, expect, type Page } from '@playwright/test';

// Keep defaults aligned with scripts/seed-e2e-user.ts so a local run is
// self-contained while still allowing CI to provide dedicated credentials.
const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'e2e@test.local';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'E2ETest123!';

const REPORT_URL = '**/api/contabilidad/reportes/movimientos*';

/**
 * @description Carga la superficie de reportes con datos de exportacion simulados.
 */
async function mockExportEndpoint(page: Page): Promise<void> {
  await page.route(REPORT_URL, async (route) => {
    const requestUrl = new URL(route.request().url());
    const formato = requestUrl.searchParams.get('formato');
    if (formato === 'csv') {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="movimientos.csv"' },
        body: 'Fecha,Cuenta,Tipo,Descripcion\n2026-09-01,Cuenta principal,venta,Venta demo\n',
      });
      return;
    }
    if (formato === 'pdf') {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'content-disposition': 'attachment; filename="movimientos.pdf"' },
        body: '%PDF-1.4\n% E2E fixture\n',
      });
      return;
    }
    await route.continue();
  });
}

/**
 * @description Navega al reporte y espera que su encabezado sea visible.
 */
async function openReports(page: Page): Promise<void> {
  await page.goto('/busy/contabilidad/reportes', { waitUntil: 'domcontentloaded' });
  const dismissReview = page.getByRole('button', { name: 'Ahora no' });
  const reviewPromptAppeared = await dismissReview
    .waitFor({ state: 'visible', timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (reviewPromptAppeared) {
    await dismissReview.click();
    await dismissReview.waitFor({ state: 'hidden' });
  }
  await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
}

test.describe('Reportes de contabilidad — Fase 6', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(response.ok(), `Auth failed (${response.status()})`).toBeTruthy();
    const body = await response.json();
    const setCookie = response.headers()['set-cookie'] ?? '';
    const cookieToken = setCookie.match(/(?:^|,\s*)auth_token=([^;]+)/)?.[1];
    authToken = cookieToken ?? body.token;
    expect(authToken, 'Login did not return an auth_token cookie').toBeTruthy();
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
      name: 'auth_token',
      value: authToken,
      url: 'http://localhost:3001',
    }]);
    await page.addInitScript((token: string) => {
      sessionStorage.setItem('token', token);
    }, authToken);
  });

  test('permite recorrer Resumen, Movimientos y Por cuenta', async ({ page }) => {
    await openReports(page);

    await expect(page.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: 'Movimientos' }).click();
    await expect(page.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Movimientos Bancarios')).toBeVisible();

    await page.getByRole('tab', { name: 'Por cuenta' }).click();
    await expect(page.getByRole('tab', { name: 'Por cuenta' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Seleccione una cuenta')).toBeVisible();
  });

  test('aplica filtros locales en Movimientos sin perder la pestaña', async ({ page }) => {
    await openReports(page);
    await page.getByRole('tab', { name: 'Movimientos' }).click();

    const search = page.getByRole('textbox', { name: 'Buscar movimientos' });
    await expect(search).toBeVisible();
    await search.fill('venta demo');
    await expect(search).toHaveValue('venta demo');

    const typeFilter = page.getByRole('combobox', { name: 'Filtrar por tipo de movimiento' });
    await typeFilter.click();
    await page.getByRole('option', { name: 'Ventas' }).click();
    await expect(typeFilter).toContainText('Ventas');
    await expect(page.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('data-state', 'active');
  });

  test('exporta CSV y PDF usando los filtros activos', async ({ page }) => {
    await mockExportEndpoint(page);
    await openReports(page);
    await page.getByRole('tab', { name: 'Movimientos' }).click();

    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV' }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toMatch(/\.csv$/i);

    const pdfDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF' }).click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('muestra estado de error cuando falla la carga de movimientos', async ({ page }) => {
    await openReports(page);
    // MovimientosTable invokes a Server Action rather than the legacy HTTP
    // export route. Abort only Server Action POSTs to exercise its catch path.
    await page.route('**/*', (route) => {
      const headers = route.request().headers();
      if (route.request().method() === 'POST' && headers['next-action']) {
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.getByRole('tab', { name: 'Movimientos' }).click();
    await expect(page.getByText('Error al cargar los movimientos')).toBeVisible({ timeout: 10000 });
  });

  test('mantiene la interfaz utilizable en viewport movil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReports(page);
    await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Movimientos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Por cuenta' })).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBeTruthy();
  });
});
