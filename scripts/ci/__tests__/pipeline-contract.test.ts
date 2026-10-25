import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');

const workflowJob = (workflow: string, jobName: string) => {
  const lines = workflow.split('\n');
  const start = lines.findIndex(line => line === `  ${jobName}:`);
  expect(start, `expected ${jobName} job to exist`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex(
    (line, index) => index > start && /^  [\w-]+:$/.test(line),
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
};

it('runs independent checks, gates build and rejects skipped dependencies', () => {
  const ci = read('.github/workflows/ci.yml');
  expect(ci).toContain("branches: [main, 'codex/**']");
  expect(ci).not.toContain('needs: [lint, typecheck]');
  expect(ci).toContain('uses: ./.github/workflows/integration.yml');
  expect(ci).toContain(
    'needs: [lint, typecheck, test, coverage, integration, build]',
  );
  expect(ci).toContain('required-checks:');
  expect(ci).toContain('if: always()');
  expect(ci).toContain('node scripts/ci/required-checks.mjs');
  expect(ci).not.toContain('post-deploy-smoke:');
  expect(ci).not.toContain('REQUIRE_POST_DEPLOY_SMOKE:');
  expect(ci).not.toMatch(/secrets\.|pull_request_target/);
});
it('keeps exact-deployment smoke manual, pinned and strict', () => {
  const smoke = read('.github/workflows/e2e-prod.yml');
  const trigger = smoke.split('\n\npermissions:')[0];
  const job = workflowJob(smoke, 'e2e-prod');
  const productionTest = read('tests/smoke/production.spec.ts');
  const triggerNames = trigger.match(/^  [\w-]+:\s*$/gm) ?? [];

  expect(triggerNames).toEqual(['  workflow_dispatch:']);
  expect(job).toContain('runs-on: ubuntu-24.04');
  expect(smoke).toContain("default: 'https://financemdm.kr4t3rdev.xyz'");
  expect(smoke).toContain('expected_sha:');
  expect(smoke).toContain('required: true');
  expect(smoke).toContain('EXPECTED_DEPLOYMENT_ENVIRONMENT: ${{ inputs.target_environment }}');
  expect(smoke).toContain('EXPECTED_DEPLOYMENT_SHA: ${{ inputs.expected_sha }}');
  expect(productionTest).toContain('EXPECTED_DEPLOYMENT_ENVIRONMENT y EXPECTED_DEPLOYMENT_SHA son obligatorios.');
  expect(productionTest).toContain('body.deploymentEnvironment).toBe(expectedDeploymentEnvironment)');
  expect(productionTest).toContain('body.deploymentSha).toBe(expectedDeploymentSha)');
});
it('keeps database mutations out of Vercel builds and scopes mobile CI to mobile files', () => {
  const vercel = JSON.parse(read('vercel.json')) as { buildCommand: string };
  const mobile = read('.github/workflows/mobile.yml');

  expect(vercel.buildCommand).not.toContain('run-prisma-schema-sync.sh');
  expect(vercel.buildCommand).not.toContain('db push');
  expect(mobile).toContain("      - 'mobile/**'");
  expect(mobile).not.toContain("      - '.github/workflows/mobile.yml'");
});
it('collects blob coverage per shard and checks thresholds only on merge', () => {
  const ci = read('.github/workflows/ci.yml');
  expect(ci).toContain('--reporter=blob');
  expect(ci).toContain('include-hidden-files: true');
  expect(ci).toContain('.vitest-reports');
  const config = read('vitest.config.mjs');
  expect(config).toContain('CI_COVERAGE_MERGE');
  for (const scope of [
    'src/lib/api/**/*.{ts,tsx}',
    'src/lib/auth/**/*.{ts,tsx}',
    'src/lib/db/**/*.{ts,tsx}',
    'src/lib/server-actions/**/*.{ts,tsx}',
    'src/features/contabilidad/domain/**/*.{ts,tsx}',
  ]) {
    expect(config).toContain(scope);
  }
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    expect(config).toContain(`${metric}: 80`);
  }
});
it('accepts only all-success required results', async () => {
  const { checkRequiredResults } = await import('../required-checks.mjs');
  const names = ['lint', 'typecheck', 'test', 'coverage', 'integration', 'build'];
  const good = Object.fromEntries(names.map(name => [name, { result: 'success' }]));
  expect(() => checkRequiredResults(good)).not.toThrow();
  expect(
    () => checkRequiredResults({ ...good, 'post-deploy-smoke': { result: 'success' } }, true),
  ).not.toThrow();
  expect(() => checkRequiredResults(good, true)).toThrow();
  for (const result of ['failure', 'skipped', 'cancelled', '', undefined]) {
    expect(() => checkRequiredResults({ ...good, build: { result } })).toThrow();
    expect(
      () => checkRequiredResults({ ...good, 'post-deploy-smoke': { result } }, true),
    ).toThrow();
  }
  expect(() => checkRequiredResults({})).toThrow();
});
it('declares compatible Vitest package families', () => {
  const deps = JSON.parse(read('package.json')).devDependencies;
  expect(deps.vitest).toBe(deps['@vitest/ui']);
  expect(deps.vitest).toBe(deps['@vitest/coverage-v8']);
  expect(deps.vitest).toBe('^3.2.4');
});
