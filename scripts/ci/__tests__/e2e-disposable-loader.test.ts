import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

it('expone el guard de BD desechable en un módulo CJS compatible con Playwright', async () => {
  const config = readFileSync('playwright.config.ts', 'utf8');
  const seed = readFileSync('scripts/seed-e2e-user.cts', 'utf8');
  const setup = readFileSync('e2e/global-setup.cjs', 'utf8');
  const teardown = readFileSync('e2e/global-teardown.cjs', 'utf8');
  expect(config).toContain("globalSetup: './e2e/global-setup.cjs'");
  expect(config).toContain("globalTeardown: './e2e/global-teardown.cjs'");
  expect(seed).toContain("import('./ci/disposable-database.cjs')");
  expect(seed).not.toContain("from './ci/disposable-database.cjs'");
  expect(setup).toContain('scripts/e2e-seed-runner.mjs');
  expect(teardown).toContain('scripts/e2e-seed-runner.mjs');

  const helper = await import('../disposable-database.cjs');
  expect(helper.assertDisposableDatabase).toEqual(expect.any(Function));
});
