import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

it('expone el guard de BD desechable en un módulo CJS compatible con Playwright', async () => {
  const seed = readFileSync('scripts/seed-e2e-user.ts', 'utf8');
  expect(seed).toContain("import('./ci/disposable-database.cjs')");
  expect(seed).not.toContain("from './ci/disposable-database.cjs'");

  const helper = await import('../disposable-database.cjs');
  expect(helper.assertDisposableDatabase).toEqual(expect.any(Function));
});
