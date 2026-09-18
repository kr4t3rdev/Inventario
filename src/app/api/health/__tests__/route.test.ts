import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '../route';

describe('GET /api/health', () => {
  afterEach(() => {
    delete process.env.DEPLOYMENT_ENVIRONMENT;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  });

  it('reports the explicit deployment environment', async () => {
    process.env.DEPLOYMENT_ENVIRONMENT = 'staging';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'abc123';

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deploymentEnvironment).toBe('staging');
    expect(body.deploymentSha).toBe('abc123');
  });
});
