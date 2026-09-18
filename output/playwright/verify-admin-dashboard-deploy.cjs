const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const EMAIL = 'kr4t3r1@gmail.com';
const PASSWORD = 'Soyelamo32.,';
const baseUrl = 'https://kr4t3rdev.xyz';
const artifactsDir = 'output/playwright';

async function extractNumberAfterLabel(page, label) {
  const body = await page.locator('body').innerText();
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const idx = lines.findIndex((line) => line === label);
  if (idx === -1) return null;
  for (let i = idx + 1; i < Math.min(lines.length, idx + 8); i += 1) {
    const line = lines[i];
    const match = line.match(/^-?\$?[0-9][0-9,\.]*/);
    if (match) return match[0];
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
  const page = await context.newPage();
  const result = { login: {}, dashboard: {}, sistema: {}, tenants: {}, finanzas: {}, licencias: {}, comparisons: {} };

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: /Iniciar sesi[oó]n/i }).click();
  await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 30000 });
  result.login = { ok: true, url: page.url() };

  await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${artifactsDir}/dashboard-live.png`, fullPage: true });
  result.dashboard = {
    url: page.url(),
    kpis: {
      totalTenants: await extractNumberAfterLabel(page, 'Total Tenants'),
      usuariosSistema: await extractNumberAfterLabel(page, 'Usuarios del Sistema'),
      sesionesActivas: await extractNumberAfterLabel(page, 'Sesiones Activas'),
      ingresosTotales: await extractNumberAfterLabel(page, 'Ingresos Totales'),
      licenciasPorVencer: await extractNumberAfterLabel(page, 'Licencias por Vencer'),
      licenciasActivas: await extractNumberAfterLabel(page, 'Licencias Activas'),
    },
    bodySnippet: (await page.locator('body').innerText()).slice(0, 2500),
  };

  await page.goto(`${baseUrl}/admin/sistema`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${artifactsDir}/sistema-live.png`, fullPage: true });
  result.sistema = {
    values: {
      usuariosTotales: await extractNumberAfterLabel(page, 'Usuarios Totales'),
      sesionesActivas: await extractNumberAfterLabel(page, 'Sesiones Activas'),
      licenciasActivas: await extractNumberAfterLabel(page, 'Licencias Activas'),
      porVencer: await extractNumberAfterLabel(page, 'Por Vencer'),
    },
  };

  await page.goto(`${baseUrl}/admin/tenants`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${artifactsDir}/tenants-live.png`, fullPage: true });
  result.tenants = {
    values: {
      totalTenants: await extractNumberAfterLabel(page, 'Total Tenants'),
      usuariosTotales: await extractNumberAfterLabel(page, 'Usuarios Totales'),
      licenciasActivas: await extractNumberAfterLabel(page, 'Licencias Activas'),
    },
    bodySnippet: (await page.locator('body').innerText()).slice(0, 1800),
  };

  await page.goto(`${baseUrl}/admin/finanzas`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${artifactsDir}/finanzas-live.png`, fullPage: true });
  const finBody = await page.locator('body').innerText();
  result.finanzas = {
    values: {
      ingresosTotales: await extractNumberAfterLabel(page, 'Ingresos Totales'),
      gastosTotales: await extractNumberAfterLabel(page, 'Gastos Totales'),
      resultadoNeto: await extractNumberAfterLabel(page, 'Resultado Neto'),
      tenants: await extractNumberAfterLabel(page, 'Tenants'),
    },
    unauthorized: finBody.includes('Unauthorized'),
    bodySnippet: finBody.slice(0, 1800),
  };

  await page.goto(`${baseUrl}/admin/licencias`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${artifactsDir}/licencias-live.png`, fullPage: true });
  result.licencias = {
    values: {
      total: await extractNumberAfterLabel(page, 'Total'),
      activas: await extractNumberAfterLabel(page, 'Activas'),
      demos: await extractNumberAfterLabel(page, 'Demos'),
      porVencer: await extractNumberAfterLabel(page, 'Por Vencer'),
      expiradas: await extractNumberAfterLabel(page, 'Expiradas'),
    },
    bodySnippet: (await page.locator('body').innerText()).slice(0, 2000),
  };

  result.comparisons = {
    dashboardVsSistema: {
      usuarios: result.dashboard.kpis.usuariosSistema === result.sistema.values.usuariosTotales,
      sesiones: result.dashboard.kpis.sesionesActivas === result.sistema.values.sesionesActivas,
      licenciasActivas: result.dashboard.kpis.licenciasActivas === result.sistema.values.licenciasActivas,
      porVencer: result.dashboard.kpis.licenciasPorVencer === result.sistema.values.porVencer,
    },
    dashboardVsTenants: {
      totalTenants: result.dashboard.kpis.totalTenants === result.tenants.values.totalTenants,
    },
    dashboardVsFinanzas: {
      ingresos: result.dashboard.kpis.ingresosTotales === result.finanzas.values.ingresosTotales,
      tenants: result.dashboard.kpis.totalTenants === result.finanzas.values.tenants,
    },
  };

  fs.writeFileSync(`${artifactsDir}/dashboard-live-verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
