import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
await page.goto('http://127.0.0.1:3000/admin/backups', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const buttons = await page.getByRole('button').evaluateAll(nodes => nodes.map(n => ({text:n.textContent?.trim(), aria:n.getAttribute('aria-label')})));
console.log(JSON.stringify({url: page.url(), buttons}, null, 2));
await page.screenshot({ path: '.tmp/backups-page.png', fullPage: true });
await browser.close();
