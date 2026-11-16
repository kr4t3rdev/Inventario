/**
 * @description Playwright globalTeardown: elimina las fixtures creadas por globalSetup.
 */
require('tsx/cjs');

const { execFile } = require('node:child_process');
const { access, rm } = require('node:fs/promises');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const E2E_FIXTURE_MANIFEST = resolve('test-results/e2e-fixture-ownership.json');
const execFileAsync = promisify(execFile);

/**
 * @description Elimina y verifica las fixtures de la corrida E2E.
 * @returns {Promise<void>} Finaliza cuando no quedan datos de la corrida.
 */
async function globalTeardown() {
  try {
    await access(E2E_FIXTURE_MANIFEST);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await execFileAsync(
    process.execPath,
    ['--import', 'tsx', 'scripts/e2e-seed-runner.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_SEED_COMMAND: 'cleanup',
        E2E_SEED_OUTPUT: E2E_FIXTURE_MANIFEST,
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  await rm(E2E_FIXTURE_MANIFEST, { force: true });
  console.log('[E2E] Limpieza de fixtures verificada.');
}

module.exports = globalTeardown;
