/**
 * @description Playwright globalSetup: crea el usuario E2E en la base de datos antes de ejecutar los tests.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { run } from '../scripts/seed-e2e-user';

export const E2E_FIXTURE_MANIFEST = resolve('test-results/e2e-fixture-ownership.json');

export default async function globalSetup(): Promise<void> {
  console.log('[E2E] Preparando fixtures aisladas...');
  const ownership = await run();
  await mkdir(dirname(E2E_FIXTURE_MANIFEST), { recursive: true });
  await writeFile(E2E_FIXTURE_MANIFEST, JSON.stringify(ownership), { mode: 0o600 });
  process.env.E2E_USER_EMAIL = ownership.email;
  process.env.E2E_USER_PASSWORD = process.env.E2E_TEST_PASSWORD;
  console.log('[E2E] Fixtures listas; manifiesto sin credenciales persistido.');
}
