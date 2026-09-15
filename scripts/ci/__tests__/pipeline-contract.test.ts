import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');

it('runs independent checks, gates build and rejects skipped dependencies', () => {
  const ci = read('.github/workflows/ci.yml');
  expect(ci).toContain("branches: [main, 'codex/**']");
  expect(ci).not.toContain('needs: [lint, typecheck]');
  expect(ci).toContain('uses: ./.github/workflows/integration.yml');
  expect(ci).toContain('needs: [lint, typecheck, test, coverage, integration]');
  expect(ci).toContain('required-checks:');
  expect(ci).toContain('if: always()');
  expect(ci).toContain('node scripts/ci/required-checks.mjs');
  expect(ci).not.toMatch(/secrets\.|pull_request_target/);
});
it('collects blob coverage per shard and checks thresholds only on merge', () => {
  const ci = read('.github/workflows/ci.yml');
  expect(ci).toContain('--reporter=blob');
  expect(ci).toContain('include-hidden-files: true');
  expect(ci).toContain('.vitest-reports');
  const config = read('vitest.config.mjs');
  expect(config).toContain('CI_COVERAGE_MERGE');
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    expect(config).toContain(`${metric}: 80`);
  }
});
it('accepts only all-success required results', async () => {
  const { checkRequiredResults } = await import('../required-checks.mjs');
  const names = ['lint', 'typecheck', 'test', 'coverage', 'integration', 'build'];
  const good = Object.fromEntries(names.map(name => [name, { result: 'success' }]));
  expect(() => checkRequiredResults(good)).not.toThrow();
  for (const result of ['failure', 'skipped', 'cancelled', '', undefined]) {
    expect(() => checkRequiredResults({ ...good, build: { result } })).toThrow();
  }
  expect(() => checkRequiredResults({})).toThrow();
});
it('declares compatible Vitest package families', () => {
  const deps = JSON.parse(read('package.json')).devDependencies;
  expect(deps.vitest).toBe(deps['@vitest/ui']);
  const family = (version: string) => version.replace(/^[^0-9]+/, '').split('.').slice(0, 2).join('.');
  expect(family(deps.vitest)).toBe(family(deps['@vitest/coverage-v8']));
  expect(family(deps.vitest)).toBe('3.2');
});
