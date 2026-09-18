/* eslint-disable */
/**
 * Benchmark del dashboard de contabilidad (uso local, no va al repo):
 *   node scripts/bench-contabilidad.js
 * Requiere el dev server corriendo en localhost:3000 y credenciales demo.
 * Mide: TTFB, tiempo a KPI "Flujo Neto" visible y cantidad de POST de server actions.
 */
const { chromium } = require('@playwright/test');

const BASE = process.env.BENCH_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.BENCH_EMAIL;
const PASSWORD = process.env.BENCH_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Requiere BENCH_EMAIL y BENCH_PASSWORD en el entorno');
  process.exit(1);
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  const loginError = await page.locator('text=/incorrect|inválid|no existe|error/i').first().textContent().catch(() => null);
  if (loginError) console.log('LOGIN_ERROR_EN_PAGINA', loginError);
  await page.waitForLoadState('domcontentloaded');
  // El login puede abrir el dashboard por client-side nav; espera activa.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000, waitUntil: 'commit' }).catchif (!EMAIL || !PASSWORD) {
  console.error('Requiere BENCH_EMAIL y BENCH_PASSWORD en el entorno');
  process.exit(1);
}
(async () => {
    console.log('LOGIN_FALLBACK_REQUEST');
    await page.goto(`${BASE}/busy/contabilidad`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  });
  console.log('POST_LOGIN_URL', page.url());

  const actionPosts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST') actionPosts.push(Date.now() + ' ' + req.url());
  });
  const rscRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('_rsc=') || req.url().includes('_rsc2')) {
      rscRequests.push(Date.now() + ' ' + req.url().slice(0, 90));
    }
  });
  const timeline = [];
  const probe = setIntervalif (!EMAIL || !PASSWORD) {
  console.error('Requiere BENCH_EMAIL y BENCH_PASSWORD en el entorno');
  process.exit(1);
}
(async () => {
    try {
      const n = await page.locator('text=/Flujo Neto del Período/i').count();
      const sk = await page.locator('.animate-pulse').count();
      timeline.push(`${Date.now() - tGlob}ms kpi=${n} skeletons=${sk}`);
    } catch {}
  }, 500);

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 300)));

  const tGlob = Date.now();
  const t0 = tGlob;
  await page.goto(`${BASE}/busy/contabilidad`, { waitUntil: 'domcontentloaded' });
  const tKpi = await page
    .waitForSelector('text=/Flujo Neto del Período/i', { timeout: 60000 })
    .then(() => Date.now())
    .catch(() => null);
  const tValor = await page
    .waitForSelector('text=/Superávit|Déficit/i', { timeout: 10000 })
    .then(() => Date.now())
    .catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  // Deja que React complete la hidratación y las animaciones de entrada.
  await page.waitForTimeout(25000);
  const kpiAlFinal = await page.locator('text=/Flujo Neto del Período/i').count();
  console.log('KPI_PRESENTE_AL_FINAL', kpiAlFinal);
  clearInterval(probe);
  console.log('TIMELINE', timeline.join(' | '));
  console.log('RSC_REQUESTS', JSON.stringify(rscRequests));
  const finOpacidad = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? getComputedStyle(h1.closest('div[class]') || h1).opacity : 'n/a';
  });

  console.log(
    JSON.stringify(
      {
        msToKpiVisible: tKpi ? tKpi - t0 : null,
        msToValorVisible: tValor ? tValor - t0 : null,
        serverActionPosts: actionPosts,
        h1Opacity: finOpacidad,
        consoleErrors,
      },
      null,
      2,
    ),
  );

  await page.screenshot({ path: '/tmp/contabilidad-bench.png', fullPage: true });
  await browser.close();
  console.log('SCREENSHOT:/tmp/contabilidad-bench.png');
})().catch((e) => {
  console.error('BENCH_FAIL', e.message);
  process.exit(1);
});
