import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('production smoke isolation', () => {
  it('does not chain seed, login or mutable cart tests', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['test:e2e:prod']).toBeUndefined();
    const command = scripts['test:smoke:prod'];
    expect(command).not.toMatch(/seed|prep|cart/);
    expect(command).toContain('playwright.smoke.config.ts');
    expect(read('.github/workflows/e2e-prod.yml')).not.toMatch(/run_seed|seed:e2e/);
  });
  it('loads database dependencies only after a disposable target guard', () => {
    const seed = read('scripts/seed-e2e-user.ts');
    expect(seed).not.toMatch(/import \{ PrismaClient \}|E2ETest123|user\.upsert/);
    expect(seed.indexOf('assertDisposableDatabase(process.env)')).toBeGreaterThan(-1);
    expect(seed.indexOf("await import('../src/generated/prisma')"))
      .toBeGreaterThan(seed.indexOf('assertDisposableDatabase(process.env)'));
    expect(seed).not.toContain('${E2E_USER.password}');
  });
  it('owns and tears down every local E2E fixture lifecycle', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['seed:e2e']).toBeUndefined();
    expect(read('playwright.config.ts')).toContain("globalTeardown: './e2e/global-teardown.ts'");
    const teardown = read('e2e/global-teardown.ts');
    expect(teardown).toContain('await cleanup(ownership)');
    expect(teardown.indexOf('await cleanup(ownership)')).toBeLessThan(
      teardown.indexOf('await rm(E2E_FIXTURE_MANIFEST'),
    );
  });
});

describe('disposable database guard', () => {
  it('rejects absent opt-in, remote, production, alternate and ambiguous targets', async () => {
    const { assertDisposableDatabase } = await import('../disposable-database.mjs');
    const url = 'postgresql://test:test@127.0.0.1:5433/tcp_test_run1';
    const safe = { ALLOW_DISPOSABLE_TEST_DB: '1', DATABASE_URL: url, DATABASE_URL_TEST: url };
    expect(() => assertDisposableDatabase(safe)).not.toThrow();
    for (const extra of [
      { ALLOW_DISPOSABLE_TEST_DB: '' }, { NODE_ENV: 'production' },
      { DATABASE_URL: 'postgresql://test:test@remote.example/tcp_test_run1' },
      { DATABASE_URL_TEST: '' }, { DIRECT_URL: 'postgresql://remote/prod' },
      { DATABASE_URL: url + '?host=remote.example' },
      { DATABASE_URL: url.replace('tcp_test_run1', 'production') },
    ]) expect(() => assertDisposableDatabase({ ...safe, ...extra })).toThrow();
  });
});

it.each([
  'postgresql://test:test@remote.invalid:5433/tcp_test_run1',
  'postgresql://test:test@127.0.0.1:5433/production',
  'postgresql://test:test@127.0.0.1:5433/tcp_test_run1?host=remote.invalid',
  'postgresql://test:test@127.0.0.1:5433/tcp_test_run1#fragment',
  'mysql://test:test@127.0.0.1:5433/tcp_test_run1',
  'postgresql://test:test@127.0.0.1/tcp_test_run1',
])('rejects an unsafe target even when every URL matches: %s', async (url) => {
  const { assertDisposableDatabase } = await import('../disposable-database.mjs');
  expect(() => assertDisposableDatabase({
    ALLOW_DISPOSABLE_TEST_DB: '1', DATABASE_URL: url, DATABASE_URL_TEST: url, DIRECT_URL: url,
  })).toThrow();
});
