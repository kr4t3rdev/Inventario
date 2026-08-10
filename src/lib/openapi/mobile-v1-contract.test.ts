import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

async function loadContract(): Promise<OpenApiDocument> {
  const contractPath = path.join(process.cwd(), 'docs/openapi/mobile-v1.json');
  return JSON.parse(await readFile(contractPath, 'utf8')) as OpenApiDocument;
}

describe('mobile v1 OpenAPI contract', () => {
  it('defines the OpenAPI foundation and bearer authentication', async () => {
    const contract = await loadContract();

    expect(contract.openapi).toBe('3.1.0');
    expect(contract.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(contract.components.schemas.ApiError).toBeDefined();
    expect(contract.components.schemas.TokenPair).toBeDefined();
  });

  it('documents every mobile authentication operation', async () => {
    const contract = await loadContract();

    expect(contract.paths['/auth/login']?.post).toBeDefined();
    expect(contract.paths['/auth/refresh']?.post).toBeDefined();
    expect(contract.paths['/auth/me']?.get).toBeDefined();
    expect(contract.paths['/auth/logout']?.post).toBeDefined();
    expect(contract.paths['/auth/tenants']?.get).toBeDefined();
    expect(contract.paths['/auth/tenants']?.post).toBeDefined();
  });

  it('matches the real mobile response envelopes', async () => {
    const contract = await loadContract();
    const apiError = contract.components.schemas.ApiError as {
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(apiError.required).toEqual(['error']);
    expect(apiError.properties.error).toEqual({ type: 'string' });
    expect(contract.paths['/auth/me']?.get).toMatchObject({
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthenticatedUser' },
            },
          },
        },
      },
    });
  });
});
