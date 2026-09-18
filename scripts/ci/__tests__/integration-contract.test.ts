import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');

it('uses a reusable isolated integration gate with matching migration/runtime targets', () => {
  const workflow = read('.github/workflows/integration.yml');
  expect(workflow).toContain('workflow_call:');
  expect(workflow).not.toContain('paths:');
  for (const name of ['DATABASE_URL', 'DATABASE_URL_TEST', 'DIRECT_URL']) {
    expect(workflow).toContain(`${name}: postgresql://test:test@127.0.0.1:5432/tcp_test_ci`);
  }
  expect(workflow.indexOf('prisma migrate deploy')).toBeLessThan(workflow.indexOf('pnpm run test:integration'));
  expect(workflow).toContain('ALLOW_DISPOSABLE_TEST_DB:');
});
it('disables env-file discovery and validates before loading integration tests', () => {
  for (const path of ['vitest.config.mjs', 'vitest.integration.config.mjs']) {
    expect(read(path)).toContain('envFile: false');
  }
  expect(read('vitest.integration.config.mjs')).toContain('assertDisposableDatabase(process.env)');
  expect(read('vitest.integration.setup.ts')).not.toContain("split('@')");
});
