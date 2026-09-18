import { test, expect } from '@playwright/test';

const expectedDeploymentEnvironment = process.env.EXPECTED_DEPLOYMENT_ENVIRONMENT;
const expectedDeploymentSha = process.env.EXPECTED_DEPLOYMENT_SHA;

if (!expectedDeploymentEnvironment || !expectedDeploymentSha) {
  throw new Error(
    'EXPECTED_DEPLOYMENT_ENVIRONMENT y EXPECTED_DEPLOYMENT_SHA son obligatorios.',
  );
}

test('deployment identity matches the expected release', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    deploymentEnvironment?: string;
    deploymentSha?: string;
    status?: string;
  };

  expect(body.status).toBe('healthy');
  expect(body.deploymentEnvironment).toBe(expectedDeploymentEnvironment);
  expect(body.deploymentSha).toBe(expectedDeploymentSha);
});

// HTTP-only public checks: no browser scripts, login, storage state or mutations.
for (const path of ['/', '/login']) {
  test(`public smoke GET ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await response.text()).toMatch(/<html/i);
  });
}
