import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
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
await page.waitForTimeout(1000);
const info = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('select')).map((select) => ({
    id: select.id,
    outer: select.outerHTML,
    options: Array.from(select.options).map((o) => ({ value: o.value, label: o.textContent?.trim() ?? '' })),
  }));
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
