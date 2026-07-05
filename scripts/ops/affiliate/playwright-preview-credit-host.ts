import { chromium } from 'playwright';

const adminEmail = process.env.ADMIN_EMAIL!;
const adminPassword = process.env.ADMIN_PASSWORD!;
const referrerCode = process.env.REFERRER_CODE!;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://kr4t3rdev.xyz/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Correo electrónico').fill(adminEmail);
  await page.getByLabel('Contraseña').fill(adminPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/admin(\/)?$/, { timeout: 30000 });

  await page.goto('https://kr4t3rdev.xyz/admin/referidos', { waitUntil: 'networkidle' });
  const row = page.locator('tr', { hasText: referrerCode }).first();
  await row.waitFor({ state: 'visible', timeout: 30000 });
  await row.getByRole('button', { name: 'Preview' }).click();
  await page.waitForLoadState('networkidle');

  console.log(JSON.stringify({ success: true, referrerCode }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
