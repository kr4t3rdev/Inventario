import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('response', async (resp) => {
  const req = resp.request();
  if (req.method() === 'POST' && resp.url().includes('/admin/backups')) {
    let text = '';
    try { text = await resp.text(); } catch {}
    console.log('ACTION', req.headers()['next-action'], 'STATUS', resp.status(), 'BODY', text.slice(0, 800));
  }
});
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);
await browser.close();
