import { describe, expect, it } from 'vitest';

import {
  findOpenApiContractViolations,
  loadMobileV1Contract,
} from '@/lib/openapi/contract-guards';

describe('mobile v1 OpenAPI hardening', () => {
  it('resolves refs and enforces operationId and security invariants', async () => {
    const contract = await loadMobileV1Contract();

    expect(findOpenApiContractViolations(contract)).toEqual([]);
  });

  it('reports broken refs, duplicate operationIds, and invalid public security', async () => {
    const contract = structuredClone(await loadMobileV1Contract());
    const login = contract.paths['/auth/login'].post as Record<string, unknown>;
    const refresh = contract.paths['/auth/refresh'].post as Record<string, unknown>;

    contract['x-broken-ref'] = { $ref: '#/components/schemas/MissingSchema' };
    login.operationId = refresh.operationId;
    login.security = [{ bearerAuth: [] }];

    expect(findOpenApiContractViolations(contract)).toEqual(expect.arrayContaining([
      'POST /auth/login: seguridad explícita inválida',
      `POST /auth/refresh: operationId duplicado ${String(refresh.operationId)}`,
      'x-broken-ref.$ref: referencia no resuelta #/components/schemas/MissingSchema',
    ]));
  });
});
