import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('request', (req) => {
  if (['fetch', 'xhr'].includes(req.resourceType())) {
    console.log('REQ', req.method(), req.url(), req.headers()['next-action'] || '');
  }
});
page.on('response', async (resp) => {
  const req = resp.request();
  if (['fetch', 'xhr'].includes(req.resourceType())) {
    console.log('RES', resp.status(), req.method(), resp.url(), req.headers()['next-action'] || '');
  }
});
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await browser.close();
