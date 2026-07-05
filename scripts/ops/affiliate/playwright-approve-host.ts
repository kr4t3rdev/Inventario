import { chromium } from 'playwright';

const adminEmail = process.env.ADMIN_EMAIL!;
const adminPassword = process.env.ADMIN_PASSWORD!;
const targetEmail = process.env.TARGET_EMAIL!;
const tenantName = process.env.TENANT_NAME || 'Affiliate HostFlow Co';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://kr4t3rdev.xyz/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Correo electrónico').fill(adminEmail);
  await page.getByLabel('Contraseña').fill(adminPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/admin(\/)?$/, { timeout: 30000 });

  await page.goto('https://kr4t3rdev.xyz/admin/usuarios', { waitUntil: 'networkidle' });
  const row = page.locator('tr', { hasText: targetEmail }).first();
  await row.waitFor({ state: 'visible', timeout: 30000 });

  const approveButton = row.locator('xpath=.//button[.//*[contains(@class,"lucide-shield-check")]]').first();
  await approveButton.click();
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByLabel('Nombre de la empresa').fill(tenantName);
  await page.getByRole('button', { name: 'Aprobar y Crear Empresa' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 30000 });

  console.log(JSON.stringify({ success: true, approved: targetEmail }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
