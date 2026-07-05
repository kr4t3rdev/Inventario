import { chromium } from '@playwright/test';
const baseUrl = 'http://127.0.0.1:3000';
const email = 'referrer-real-1783109828850@test.local';
const password = 'RealPass123!';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar/i }).click();
  await page.waitForTimeout(4000);
  console.log('cookies', await context.cookies());
  await page.goto(`${baseUrl}/busy/referidos`);
  await page.waitForLoadState('networkidle');
  const heading = page.getByRole('heading', { name: /programa de referidos/i });
  try {
    await heading.waitFor({ timeout: 120000 });
    console.log('HEADING_OK');
  } catch (error) {
    console.log('HEADING_TIMEOUT');
  }
  console.log('URL_REFERIDOS', page.url());
  console.log('BODY_REFERIDOS', (await page.locator('body').innerText()).slice(0, 5000));
  await page.screenshot({ path: '/Users/arturo/Documents/Proyecto Inventario/TCP/output/affiliate-real/referrer-referidos-debug2.png', fullPage: true });
  await browser.close();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
