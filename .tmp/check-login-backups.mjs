import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror:', err.message));
page.on('response', (resp) => {
  if (resp.url().includes('/api/auth/login')) console.log('login-response', resp.status(), resp.url());
});

await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForTimeout(3000);
console.log('after-login-url', page.url());
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
console.log('backups-url', page.url());
console.log('has-nueva-copia', await page.getByRole('button', { name: /Nueva copia/i }).isVisible().catch(() => false));
await browser.close();
