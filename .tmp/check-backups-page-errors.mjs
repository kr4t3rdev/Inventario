import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror:', err.message, err.stack || ''));
page.on('requestfailed', (req) => console.log('requestfailed:', req.url(), req.failure()?.errorText));
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.getByLabel('Correo electrónico').fill('e2e@test.local');
await page.getByLabel('Contraseña').fill('E2ETest123!');
await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
await page.waitForTimeout(3000);
await page.goto('http://localhost:3000/admin/backups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await browser.close();
