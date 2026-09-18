import { chromium } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

function ok(name, extra = '') { results.push({ name, ok: true, extra }); }
function fail(name, extra = '') { results.push({ name, ok: false, extra }); }

try {
  await page.goto(baseURL + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_USER_EMAIL || 'admin@correo.com');
  await page.getByLabel('Contraseña').fill(process.env.E2E_USER_PASSWORD || '123456');
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
  await page.waitForTimeout(3000);

  const loginError = page.getByText(/Credenciales inválidas/i);
  if (await loginError.isVisible().catch(() => false)) {
    fail('login', 'Credenciales inválidas');
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 });
  ok('login');

  await page.goto(baseURL + '/admin/backups', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Nueva copia/i }).click();
  await page.getByText('Nueva copia de seguridad').waitFor({ timeout: 10000 });
  ok('open manual backup dialog');

  await page.getByRole('button', { name: /Por Tenant/i }).first().click();
  await page.getByLabel('Tenant').waitFor({ timeout: 5000 });
  const submitButton = page.getByRole('button', { name: /Iniciar copia/i });
  const disabledBefore = await submitButton.isDisabled();
  if (disabledBefore) ok('tenant backup requires tenant selection');
  else fail('tenant backup requires tenant selection', 'submit should be disabled before selecting tenant');

  const tenantOptions = await page.locator('#backup-tenant option').allTextContents();
  if (tenantOptions.length > 1) {
    await page.selectOption('#backup-tenant', { index: 1 });
    const disabledAfter = await submitButton.isDisabled();
    if (!disabledAfter) ok('tenant backup enables submit after tenant selection', tenantOptions[1]);
    else fail('tenant backup enables submit after tenant selection');
  } else {
    fail('tenant backup tenant options available', JSON.stringify(tenantOptions));
  }

  await page.getByRole('button', { name: /Cancelar/i }).click();
  await page.getByRole('tab', { name: /Planes/i }).click();
  await page.getByRole('button', { name: /Nuevo plan/i }).click();
  await page.getByText('Nuevo plan').waitFor({ timeout: 5000 });
  ok('open backup plan dialog');

  await page.locator('select').first().selectOption('tenant');
  await page.getByLabel('Tenant').waitFor({ timeout: 5000 });
  const createPlanButton = page.getByRole('button', { name: /Crear plan/i });
  const planDisabledBefore = await createPlanButton.isDisabled();
  if (planDisabledBefore) ok('tenant plan requires tenant selection');
  else fail('tenant plan requires tenant selection', 'create plan should be disabled before selecting tenant');

  const planTenantOptions = await page.locator('#plan-tenant option').allTextContents();
  if (planTenantOptions.length > 1) {
    await page.selectOption('#plan-tenant', { index: 1 });
    const planDisabledAfter = await createPlanButton.isDisabled();
    if (!planDisabledAfter) ok('tenant plan enables submit after tenant selection', planTenantOptions[1]);
    else fail('tenant plan enables submit after tenant selection');
  } else {
    fail('tenant plan tenant options available', JSON.stringify(planTenantOptions));
  }

  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error(error?.stack || String(error));
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
