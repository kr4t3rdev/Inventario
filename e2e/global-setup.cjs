/**
 * @description Playwright globalSetup: crea el usuario E2E en la base de datos antes de ejecutar los tests.
 */
require('tsx/cjs');

const { execFile } = require('node:child_process');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const { promisify } = require('node:util');

const E2E_FIXTURE_MANIFEST = resolve('test-results/e2e-fixture-ownership.json');
const execFileAsync = promisify(execFile);

/**
 * @description Prepara fixtures E2E aisladas y publica sus identificadores de prueba.
 * @returns {Promise<void>} Finaliza cuando las fixtures están persistidas.
 */
async function globalSetup() {
  console.log('[E2E] Preparando fixtures aisladas...');
  await mkdir(dirname(E2E_FIXTURE_MANIFEST), { recursive: true });
  await execFileAsync(
    process.execPath,
    ['--import', 'tsx', 'scripts/e2e-seed-runner.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_SEED_COMMAND: 'run',
        E2E_SEED_OUTPUT: E2E_FIXTURE_MANIFEST,
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const ownership = JSON.parse(await readFile(E2E_FIXTURE_MANIFEST, 'utf8'));
  await writeFile(E2E_FIXTURE_MANIFEST, JSON.stringify(ownership), { mode: 0o600 });
  process.env.E2E_USER_EMAIL = ownership.email;
  process.env.E2E_USER_PASSWORD = process.env.E2E_TEST_PASSWORD;
  process.env.E2E_PURCHASE_ORDER_VENDOR_ID = ownership.fixtures.proveedorId;
  process.env.E2E_PURCHASE_ORDER_PRODUCT_ID = ownership.fixtures.productoId;
  process.env.E2E_PURCHASE_ORDER_WAREHOUSE_ID = ownership.fixtures.almacenId;
  console.log('[E2E] Fixtures listas; manifiesto sin credenciales persistido.');
}

module.exports = globalSetup;
