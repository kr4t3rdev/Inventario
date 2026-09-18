import { readFile, rm } from 'node:fs/promises';
import { cleanup, type E2EFixtureOwnership } from '../scripts/seed-e2e-user';
import { E2E_FIXTURE_MANIFEST } from './global-setup';

/**
 * @description Elimina y verifica las fixtures creadas por el global setup de Playwright.
 * @returns {Promise<void>} Finaliza cuando no quedan el tenant ni el usuario propiedad de la corrida.
 */
export default async function globalTeardown(): Promise<void> {
  const ownership = JSON.parse(
    await readFile(E2E_FIXTURE_MANIFEST, 'utf8'),
  ) as E2EFixtureOwnership;
  await cleanup(ownership);
  await rm(E2E_FIXTURE_MANIFEST, { force: true });
  console.log('[E2E] Limpieza de fixtures verificada.');
}
