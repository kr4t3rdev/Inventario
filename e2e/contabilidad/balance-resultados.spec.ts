import { test, expect, type Page } from '@playwright/test';

const E2E_EMAIL = 'e2e@test.local';
const E2E_PASSWORD = 'E2ETest123!';
const REPORT_URL = '**/api/contabilidad/balance-financiero*';

const reportBase = {
  balance: {
    activos: { efectivo: 1000, inventario: 200, cuentasPorCobrar: 50, total: 1250 },
    pasivos: { deudaExterna: 150, cuentasPorPagar: 100, total: 250 },
    patrimonio: {
      capitalSocial: 800,
      resultadosAcumulados: 50,
      resultadoPeriodo: 150,
      utilidadEjercicio: 150,
      total: 1000,
    },
    ecuacion: { assets: 1250, liabilitiesAndEquity: 1250, difference: 0, status: 'CUADRADO' },
    cobertura: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
    incidencias: [],
    monedaFuncional: 'CUP',
  },
  estadoResultados: {
    mensual: [],
    anual: {
      totalIngresos: 500,
      gastosCompras: 0,
      gastosSalarios: 100,
      gastosGenerales: 50,
      gastosMermas: 0,
      totalGastos: 250,
      utilidadNeta: 150,
    },
    incidencias: [],
  },
  reporte: {
    origen: 'LIVE',
    provisional: true,
    fechaCorte: '2026-08-21T15:30:00.000Z',
    resultadoHasta: null,
    periodoId: 'period-2026',
    integridad: null,
    snapshotVersion: null,
  },
};

const emptyReport = {
  ...reportBase,
  balance: {
    ...reportBase.balance,
    activos: { efectivo: 0, inventario: 0, cuentasPorCobrar: 0, total: 0 },
    pasivos: { deudaExterna: 0, total: 0 },
    patrimonio: { capitalSocial: 0, utilidadEjercicio: 0, total: 0 },
    ecuacion: { assets: 0, liabilitiesAndEquity: 0, difference: 0, status: 'CUADRADO' },
  },
  estadoResultados: {
    ...reportBase.estadoResultados,
    anual: {
      totalIngresos: 0,
      gastosCompras: 0,
      gastosSalarios: 0,
      gastosGenerales: 0,
      gastosMermas: 0,
      totalGastos: 0,
      utilidadNeta: 0,
    },
  },
};

function createPartialReport() {
  return {
    ...reportBase,
    balance: {
      ...reportBase.balance,
      cobertura: { complete: false, unresolvedCount: 1, unresolvedAmount: 50, parts: [{}] },
    },
  };
}

function createDifferenceReport() {
  return {
    ...reportBase,
    balance: {
      ...reportBase.balance,
      activos: { efectivo: 1025, inventario: 200, cuentasPorCobrar: 50, total: 1275 },
      ecuacion: { assets: 1275, liabilitiesAndEquity: 1250, difference: 25, status: 'DIFERENCIA' },
    },
  };
}

function createConversionGapReport() {
  return {
    ...reportBase,
    balance: {
      ...reportBase.balance,
      monedaFuncional: 'USD',
      cobertura: { complete: false, unresolvedCount: 1, unresolvedAmount: 300, parts: [{}] },
      incidencias: [{ code: 'MISSING_EXCHANGE_RATE', affectedAmount: 300 }],
    },
  };
}

async function mockReportApis(
  page: Page,
  report: unknown,
  options?: { errorYear?: number; delayYear?: number; release?: Promise<void> },
): Promise<void> {
  await page.route(REPORT_URL, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/periodos')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          periodos: [
            { periodId: 'period-2026', code: '2026', year: 2026, cutoffAt: '2026-12-31T23:59:59.999Z', snapshotVersion: 2 },
            { periodId: 'period-2025', code: '2025', year: 2025, cutoffAt: '2025-12-31T23:59:59.999Z', snapshotVersion: 2 },
          ],
        }),
      });
      return;
    }

    const requestedYear = Number(url.searchParams.get('year'));
    if (options?.delayYear === requestedYear) {
      await options.release;
    }

    if (options?.errorYear === requestedYear) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No existe evidencia histórica suficiente.' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(report),
    });
  });
}

test.describe('Balance general y resultados', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(response.ok(), `Auth failed (${response.status()}): ${await response.text()}`).toBeTruthy();
    authToken = (await response.json()).token;
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

  test('muestra estado vacío para una empresa sin datos', async ({ page }) => {
    await mockReportApis(page, emptyReport);
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByRole('heading', { name: 'Balance general y resultados' })).toBeVisible();
    await expect(page.getByText('Sin actividad registrada')).toBeVisible();
    await expect(page.getByText('Reporte provisional en vivo')).toBeVisible();
  });

  test('muestra cobertura parcial y acceso a pendientes', async ({ page }) => {
    await mockReportApis(page, createPartialReport());
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByText('Cobertura parcial')).toBeVisible();
    await expect(page.getByRole('link', { name: /Revisar pendientes/i })).toHaveAttribute(
      'href',
      '/busy/contabilidad/reconciliacion',
    );
    await page.getByRole('tab', { name: /Resultados/i }).click();
    await expect(page.getByText('Período de resultados')).toBeVisible();
  });

  test('confirma un balance cuadrado', async ({ page }) => {
    await mockReportApis(page, reportBase);
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByText('Activos = Pasivos + Patrimonio')).toBeVisible();
    await expect(page.getByText('Estado: cuadrado')).toBeVisible();
    await expect(page.getByText('Cobertura completa')).toBeVisible();
    await expect(page.getByText('Fuente: Cuentas bancarias')).toBeVisible();
  });

  test('expone una diferencia contable sin depender solo del color', async ({ page }) => {
    await mockReportApis(page, createDifferenceReport());
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByText('Estado: diferencia')).toBeVisible();
    await expect(page.getByText('Diferencia detectada')).toBeVisible();
  });

  test('muestra cobertura parcial cuando falta una conversión entre monedas', async ({ page }) => {
    await mockReportApis(page, createConversionGapReport());
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByText('Moneda funcional USD')).toBeVisible();
    await expect(page.getByText('Cobertura parcial')).toBeVisible();
    await expect(page.getByRole('link', { name: /Revisar pendientes/i })).toBeVisible();
  });

  test('limpia los datos anteriores y muestra error al cambiar a un período sin evidencia', async ({ page }) => {
    const currentYear = new Date().getFullYear();
    let releaseDelayedResponse!: () => void;
    const delayedResponse = new Promise<void>((resolve) => {
      releaseDelayedResponse = resolve;
    });
    await mockReportApis(page, reportBase, {
      errorYear: currentYear - 1,
      delayYear: currentYear - 1,
      release: delayedResponse,
    });
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByText('Activos = Pasivos + Patrimonio')).toBeVisible();
    await page.getByRole('combobox', { name: 'Seleccionar período contable' }).click();
    await page.getByRole('option', { name: new RegExp(`^${currentYear - 1}`) }).click();

    await expect(page.getByText('Activos = Pasivos + Patrimonio')).not.toBeVisible();
    releaseDelayedResponse();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('No existe evidencia histórica suficiente.')).toBeVisible();
    await expect(page.getByText('Activos = Pasivos + Patrimonio')).not.toBeVisible();
  });

  test('mantiene la navegación principal usable en viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReportApis(page, createPartialReport());
    await page.goto('/busy/contabilidad/balance-resultados');

    await expect(page.getByRole('heading', { name: 'Balance general y resultados' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Balance general/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Resultados/i })).toBeVisible();
    await page.getByText('Cómo leer este reporte').click();
    await expect(page.getByText(/este reporte se calcula en vivo/i)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Detalle de activos, pasivos y patrimonio' })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
