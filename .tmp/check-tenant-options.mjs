import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
page.on('response', (resp) => {
  const u = resp.url();
  if (u.includes('__next') || u.includes('/api/')) console.log('resp', resp.status(), u);
});
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /Nueva copia/i }).click();
await page.getByRole('button', { name: /Por Tenant/i }).click();
for (let i = 0; i < 10; i++) {
  const options = await page.locator('#backup-tenant option').evaluateAll((els) =>
    els.map((el) => ({ value: el.value, label: el.textContent?.trim() ?? '' }))
  );
  console.log('poll', i, JSON.stringify(options));
  await page.waitForTimeout(1000);
}
await browser.close();
