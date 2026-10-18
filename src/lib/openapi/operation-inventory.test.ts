import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildInventory,
  discoverRouteOperations,
  documentedOperations,
  loadContract,
} from '../../../scripts/openapi/inventory.mjs';

/**
 * Pruebas del inventario de operaciones OpenAPI mobile v1.
 *
 * El inventario compara el conjunto real de handlers exportados por las rutas
 * contra las operaciones documentadas en docs/openapi/mobile-v1.json, sin
 * depender de conteos fijos: la paridad se exige por igualdad de conjuntos.
 */
describe('mobile v1 operation inventory', () => {
  it('documenta exactamente las operaciones reales de las rutas móviles', async () => {
    const [contract, discovered] = await Promise.all([
      loadContract(),
      discoverRouteOperations(),
    ]);

    expect(discovered.anomalies).toEqual([]);
    expect(discovered.operations).toEqual(documentedOperations(contract));
  });

  it('incluye operaciones representativas de cada familia documentada', async () => {
    const [contract, discovered] = await Promise.all([
      loadContract(),
      discoverRouteOperations(),
    ]);

    for (const operation of [
      'POST /auth/login',
      'GET /sales',
      'POST /accounting/bank-adjustments',
      'POST /accounting/capital-injections',
      'GET /empleados',
      'POST /units/create',
    ]) {
      expect(discovered.operations, operation).toContain(operation);
      const [method, ...routeParts] = operation.split(' ');
      const pathItem = contract.paths[routeParts.join(' ')];
      expect(pathItem?.[method.toLowerCase()], operation).toBeDefined();
    }
  });

  it('construye filas con esquema de request, seguridad, servicios y consumidores', async () => {
    const [contract, discovered] = await Promise.all([
      loadContract(),
      discoverRouteOperations(),
    ]);
    const inventory = await buildInventory(contract, discovered, { mobileSrcDirectory: 'mobile/src' });

    const adjustment = inventory.rows.find((row) =>
      row.operation === 'POST /accounting/bank-adjustments');
    expect(adjustment?.documented).toBe(true);
    expect(adjustment?.requestSchemaName).toBe('BankAdjustmentRequest');
    expect(adjustment?.security).toBe('bearer');
    expect(adjustment?.routeServices).toContain('AccountingOperationsMutationService');

    const capital = inventory.rows.find((row) =>
      row.operation === 'POST /accounting/capital-injections');
    expect(capital?.requestSchemaName).toBe('CapitalInjectionCreateRequest');
    // In CI/Vercel checkouts without mobile/, consumer inventory is intentionally empty.
    if (existsSync('mobile/src')) {
      expect(capital?.mobileConsumerFiles).toContain('capital-api.ts');
    } else {
      expect(capital?.mobileConsumerFiles).toEqual([]);
    }
  });

  it('reporta deltas estructurales sin depender de conteos fijos', async () => {
    const [contract, discovered] = await Promise.all([
      loadContract(),
      discoverRouteOperations(),
    ]);
    const inventory = await buildInventory(contract, discovered, { mobileSrcDirectory: 'mobile/src' });

    expect(inventory.summary.missing).toEqual([]);
    expect(inventory.summary.obsolete).toEqual([]);
    expect(inventory.summary.duplicateOperationIds).toEqual([]);
    expect(inventory.summary.anomalies).toEqual([]);
    expect(inventory.rows.every((row) => row.operationId.length > 0)).toBe(true);
  });
});
