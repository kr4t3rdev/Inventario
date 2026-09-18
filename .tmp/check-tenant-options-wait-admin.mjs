import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('response', async (resp) => {
  const req = resp.request();
  if (req.method() === 'POST' && resp.url().includes('/admin')) {
    console.log('ACTION', resp.url(), req.headers()['next-action'], resp.status());
  }
});
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
await page.waitForTimeout(5000);
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.getByRole('button', { name: /Nueva copia/i }).click();
await page.getByRole('button', { name: /Por Tenant/i }).click();
const options = await page.locator('#backup-tenant option').evaluateAll((els) =>
  els.map((el) => ({ value: el.value, label: el.textContent?.trim() ?? '' }))
);
console.log('OPTIONS', JSON.stringify(options));
await browser.close();
