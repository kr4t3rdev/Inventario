import { describe, expect, it, vi } from 'vitest';
import {
  buildCatalogQuery,
  buildPreflightQueries,
  buildServiceRelationIssuesQuery,
  classifyCounts,
  classifyOwnershipFacts,
  runReadOnlyPreflight,
  validateTarget,
} from '../preflight-accounting-tenant-hardening.mjs';

const fullColumns = {
  CierreContable: { tenantId: true },
  PagoCuentaPorPagar: { tenantId: true },
  Servicios: { tenantId: true, vendorId: true },
  CompraServicio: { tenantId: true, proveedorId: true },
  GastoCompra: { tenantId: true },
};

function catalogRows(columns: Record<string, Record<string, boolean>>) {
  return Object.entries(columns).flatMap(([table_name, values]) =>
    Object.entries(values).map(([column_name, present]) => ({ table_name, column_name, present })),
  );
}

function makeClient(responses: Array<{ rows: unknown[] }>) {
  const statements: string[] = [];
  const query = vi.fn(async (sql: string) => {
    statements.push(sql);
    const response = responses.shift();
    if (!response) throw new Error('unexpected query');
    return response;
  });
  return { client: { query }, query, statements };
}

describe('accounting tenant preflight', () => {
  it('keeps classifications disjoint and derives blockers from aggregate counts', () => {
    expect(classifyCounts([
      { category: 'ready', count: '5' },
      { category: 'missing', count: 1 },
      { category: 'ambiguous', count: 2 },
      { category: 'invalid', count: 3 },
    ])).toEqual({ ready: 5, missing: 1, ambiguous: 2, invalid: 3, scanned: 11, blockers: 6 });
    expect(() => classifyCounts([{ category: 'ready', count: -1 }])).toThrow();
    expect(() => classifyCounts([{ category: 'business-value', count: 1 }])).toThrow();
  });

  it('classifies the five migration tables across missing, null/orphan, conflict, ambiguous, and valid cases', () => {
    const scenarios = [
      ['CierreContable', { tenantColumnPresent: false }, 'missing'],
      ['CierreContable', { tenantColumnPresent: true, existingTenant: 't1', existingTenantValid: true }, 'ready'],
      ['CierreContable', { tenantColumnPresent: true, existingTenant: 't1', existingTenantValid: false }, 'invalid'],
      ['PagoCuentaPorPagar', { parentExists: false }, 'invalid'],
      ['PagoCuentaPorPagar', { parentExists: true, parentTenantValid: true, parentTenant: 't1' }, 'ready'],
      ['PagoCuentaPorPagar', { parentExists: true, parentTenantValid: true, parentTenant: 't1', existingTenant: 't2' }, 'invalid'],
      ['Servicios', { invalidSource: true, lineageTenants: [] }, 'invalid'],
      ['Servicios', { lineageTenants: [] }, 'missing'],
      ['Servicios', { lineageTenants: ['t1', 't2'] }, 'ambiguous'],
      ['Servicios', { lineageTenants: ['t1'], existingTenant: 't2' }, 'invalid'],
      ['Servicios', { lineageTenants: ['t1'], existingTenant: 't1' }, 'ready'],
      ['CompraServicio', { serviceExists: false }, 'invalid'],
      ['CompraServicio', { serviceExists: true, serviceCategory: 'missing' }, 'missing'],
      ['CompraServicio', { serviceExists: true, serviceCategory: 'ambiguous' }, 'ambiguous'],
      ['CompraServicio', { serviceExists: true, serviceCategory: 'ready', serviceTenant: 't1', vendorSpecified: true, vendorExists: true, vendorTenant: 't2' }, 'invalid'],
      ['CompraServicio', { serviceExists: true, serviceCategory: 'ready', serviceTenant: 't1', vendorSpecified: true, vendorExists: true, vendorTenant: 't1', existingTenant: 't1' }, 'ready'],
      ['GastoCompra', { productExists: false }, 'invalid'],
      ['GastoCompra', { productExists: true, vendorExists: true, tenantsValid: true, productTenant: 't1', vendorTenant: 't2' }, 'ambiguous'],
      ['GastoCompra', { productExists: true, vendorExists: true, tenantsValid: true, productTenant: 't1', vendorTenant: 't1', existingTenant: 't2' }, 'invalid'],
      ['GastoCompra', { productExists: true, vendorExists: true, tenantsValid: true, productTenant: 't1', vendorTenant: 't1' }, 'ready'],
    ] as const;
    for (const [table, facts, expected] of scenarios) {
      expect(classifyOwnershipFacts(table, facts)).toBe(expected);
    }
    const partition = scenarios.reduce<Record<string, number>>((counts, [table, facts]) => {
      const category = classifyOwnershipFacts(table, facts);
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {});
    expect(Object.values(partition).reduce((sum, count) => sum + count, 0)).toBe(scenarios.length);
    expect(Object.keys(partition).sort()).toEqual(['ambiguous', 'invalid', 'missing', 'ready']);
  });

  it('builds SQL from fixed identifiers and omits optional columns absent in legacy schemas', () => {
    const query = buildPreflightQueries({
      CierreContable: { tenantId: false },
      PagoCuentaPorPagar: { tenantId: false },
      Servicios: { tenantId: false, vendorId: false },
      CompraServicio: { tenantId: false, proveedorId: false },
      GastoCompra: { tenantId: false },
    });
    expect(query.CierreContable).toContain("'missing'");
    expect(query.PagoCuentaPorPagar).not.toContain('pago."tenantId"');
    expect(query.Servicios).not.toContain('servicio."vendorId"');
    expect(query.Servicios).not.toContain('SELECT servicio."servicioId", servicio."tenantId"');
    expect(query.CompraServicio).not.toContain('compra."tenantId"');
    expect(query.CompraServicio).not.toContain('compra."proveedorId"');
    expect(query.GastoCompra).not.toContain('gasto."tenantId"');
    expect(Object.values(query).every((sql) => /^WITH[\s\S]*SELECT/i.test(sql))).toBe(true);
    expect(buildCatalogQuery()).toContain('information_schema.columns');
    expect(buildCatalogQuery()).not.toContain('current_database()');
    expect(buildServiceRelationIssuesQuery()).toMatch(/^SELECT count\(\*\)::bigint/i);
    expect(buildServiceRelationIssuesQuery()).not.toMatch(/\bLIMIT\s+1\b/i);
  });

  it('restricts defaults to explicit loopback test databases and never returns credentials', () => {
    const local = validateTarget(
      'postgresql://operator:secret@127.0.0.1:5433/tcp_test_local',
    );
    expect(local).toEqual({ host: '127.0.0.1', database: 'tcp_test_local' });
    expect(JSON.stringify(local)).not.toContain('secret');
    expect(() => validateTarget('postgresql://operator:secret@db.example/app')).toThrow();
    expect(validateTarget(
      'postgresql://operator:secret@db.example/app',
      'db.example/app',
    )).toEqual({ host: 'db.example', database: 'app' });
  });

  it('allows empty legacy tables with missing tenant columns and returns only aggregate counts', async () => {
    const missing = Object.fromEntries(
      Object.entries(fullColumns).map(([table, values]) => [
        table,
        Object.fromEntries(Object.keys(values).map((column) => [column, false])),
      ]),
    );
    const { client, statements } = makeClient([
      { rows: [] },
      { rows: catalogRows(missing) },
      ...Object.keys(fullColumns).map(() => ({ rows: [] })),
      { rows: [{ count: '0' }] },
      { rows: [] },
    ]);
    const report = await runReadOnlyPreflight(client);
    expect(report.decision).toBe('GO');
    expect(report.blockers).toBe(0);
    expect(report.relationIssues).toBe(0);
    expect(report.schemaRemediation).toHaveLength(5);
    expect((report.results as Record<string, unknown>).CierreContable).toEqual({
      ready: 0, missing: 0, ambiguous: 0, invalid: 0, scanned: 0, blockers: 0,
    });
    expect(JSON.stringify(report)).not.toMatch(/@|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/i);
    expect(statements[0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(statements.at(-1)).toBe('ROLLBACK');
  });

  it('rolls back and preserves the query error without exposing source rows', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith('BEGIN')) return { rows: [] };
      if (sql.includes('information_schema.columns')) return { rows: catalogRows(fullColumns) };
      if (sql === 'ROLLBACK') return { rows: [] };
      throw new Error('synthetic failure');
    });
    const client = { query };
    await expect(runReadOnlyPreflight(client)).rejects.toThrow('synthetic failure');
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(statements.every((sql) => /^(BEGIN TRANSACTION|SELECT|WITH|ROLLBACK)/i.test(sql.trim()))).toBe(true);
    expect(statements.some((sql) => /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql))).toBe(false);
  });
});
