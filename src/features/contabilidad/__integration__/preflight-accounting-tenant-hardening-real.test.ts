import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { runReadOnlyPreflight } from '../../../../scripts/ops/preflight-accounting-tenant-hardening.mjs';

const EXPECTED_DATABASE = 'tcp_test_r6_tenants_green_20261012_f48c2d17';

async function assertAssignedDatabase(client: Client): Promise<void> {
  assertDisposableDatabase(process.env);
  expect(process.env.TCP_ACCOUNTING_TENANT_PREFLIGHT_DB).toBe(EXPECTED_DATABASE);
  const identity = await client.query(`SELECT current_database() AS database_name,
      current_user AS user_name, inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port`);
  expect(identity.rows).toEqual([{
    database_name: EXPECTED_DATABASE,
    user_name: 'arturo',
    server_address: '127.0.0.1/32',
    server_port: 5433,
  }]);

  const activity = await client.query(`SELECT count(*)::int AS active_sessions
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()`);
  expect(activity.rows[0].active_sessions).toBe(0);

  const ledger = await client.query(`SELECT
      count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS completed,
      count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished
    FROM public."_prisma_migrations"`);
  expect(ledger.rows).toEqual([{ completed: 148, unfinished: 0 }]);
}

async function createSyntheticFixture(client: Client, schema: string): Promise<void> {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY);
    CREATE TABLE "Vendor" ("vendorId" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "Producto" ("id" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "CuentaPorPagar" (
      "cuentaPorPagarId" TEXT PRIMARY KEY, "tenantId" TEXT
    );
    CREATE TABLE "Servicios" (
      "servicioId" TEXT PRIMARY KEY, "tenantId" TEXT, "vendorId" TEXT
    );
    CREATE TABLE "VentaServicios" (
      "ventaServicioId" TEXT PRIMARY KEY, "servicioId" TEXT, "tenantId" TEXT
    );
    CREATE TABLE "CierreContable" ("cierreId" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "PagoCuentaPorPagar" (
      "pagoCuentaPorPagarId" TEXT PRIMARY KEY, "cuentaPorPagarId" TEXT, "tenantId" TEXT
    );
    CREATE TABLE "CompraServicio" (
      "compraServicioId" TEXT PRIMARY KEY, "servicioId" TEXT, "proveedorId" TEXT, "tenantId" TEXT
    );
    CREATE TABLE "GastoCompra" (
      "gastoCompraId" TEXT PRIMARY KEY, "productoId" TEXT, "vendorId" TEXT, "tenantId" TEXT
    );

    INSERT INTO "tenants" VALUES ('synthetic-tenant-a'), ('synthetic-tenant-b');
    INSERT INTO "Vendor" VALUES
      ('synthetic-vendor-a', 'synthetic-tenant-a'),
      ('synthetic-vendor-b', 'synthetic-tenant-b'),
      ('synthetic-vendor-invalid', 'synthetic-missing-tenant');
    INSERT INTO "Producto" VALUES
      ('synthetic-product-a', 'synthetic-tenant-a'),
      ('synthetic-product-b', 'synthetic-tenant-b'),
      ('synthetic-product-invalid', 'synthetic-missing-tenant');
    INSERT INTO "CuentaPorPagar" VALUES
      ('synthetic-account-a', 'synthetic-tenant-a'),
      ('synthetic-account-b', 'synthetic-tenant-b'),
      ('synthetic-account-invalid', 'synthetic-missing-tenant');

    INSERT INTO "CierreContable" VALUES
      ('synthetic-closure-ready', 'synthetic-tenant-a'),
      ('synthetic-closure-missing', NULL),
      ('synthetic-closure-invalid', 'synthetic-missing-tenant');
    INSERT INTO "PagoCuentaPorPagar" VALUES
      ('synthetic-payment-ready', 'synthetic-account-a', NULL),
      ('synthetic-payment-conflict', 'synthetic-account-a', 'synthetic-tenant-b'),
      ('synthetic-payment-orphan', 'synthetic-account-missing', NULL),
      ('synthetic-payment-invalid-parent', 'synthetic-account-invalid', NULL);

    INSERT INTO "Servicios" VALUES
      ('synthetic-service-ready', 'synthetic-tenant-a', NULL),
      ('synthetic-service-missing', NULL, NULL),
      ('synthetic-service-ambiguous', NULL, NULL),
      ('synthetic-service-conflict', 'synthetic-tenant-b', NULL),
      ('synthetic-service-null-owner', NULL, NULL),
      ('synthetic-service-invalid-vendor', NULL, 'synthetic-vendor-invalid'),
      ('synthetic-service-existing-only', 'synthetic-tenant-a', NULL),
      ('synthetic-service-invalid-owner', NULL, NULL);
    INSERT INTO "VentaServicios" VALUES
      ('synthetic-sale-owner-ready', 'synthetic-service-ready', 'synthetic-tenant-a'),
      ('synthetic-sale-owner-ambiguous-a', 'synthetic-service-ambiguous', 'synthetic-tenant-a'),
      ('synthetic-sale-owner-ambiguous-b', 'synthetic-service-ambiguous', 'synthetic-tenant-b'),
      ('synthetic-sale-owner-conflict', 'synthetic-service-conflict', 'synthetic-tenant-a'),
      ('synthetic-sale-owner-null', 'synthetic-service-null-owner', NULL),
      ('synthetic-sale-owner-invalid', 'synthetic-service-invalid-owner', 'synthetic-missing-tenant'),
      ('synthetic-sale-orphan', 'synthetic-service-absent', 'synthetic-tenant-a');

    INSERT INTO "CompraServicio" VALUES
      ('synthetic-purchase-ready', 'synthetic-service-ready', 'synthetic-vendor-a', 'synthetic-tenant-a'),
      ('synthetic-purchase-missing', 'synthetic-service-missing', NULL, NULL),
      ('synthetic-purchase-ambiguous', 'synthetic-service-ambiguous', NULL, NULL),
      ('synthetic-purchase-conflict', 'synthetic-service-ready', NULL, 'synthetic-tenant-b'),
      ('synthetic-purchase-vendor-conflict', 'synthetic-service-ready', 'synthetic-vendor-b', NULL),
      ('synthetic-purchase-orphan', 'synthetic-service-absent', NULL, NULL),
      ('synthetic-purchase-invalid-service', 'synthetic-service-conflict', NULL, NULL);
    INSERT INTO "GastoCompra" VALUES
      ('synthetic-expense-ready', 'synthetic-product-a', 'synthetic-vendor-a', NULL),
      ('synthetic-expense-conflict', 'synthetic-product-a', 'synthetic-vendor-a', 'synthetic-tenant-b'),
      ('synthetic-expense-ambiguous', 'synthetic-product-a', 'synthetic-vendor-b', NULL),
      ('synthetic-expense-orphan-product', 'synthetic-product-absent', 'synthetic-vendor-a', NULL),
      ('synthetic-expense-orphan-vendor', 'synthetic-product-a', 'synthetic-vendor-absent', NULL),
      ('synthetic-expense-invalid-tenant', 'synthetic-product-invalid', 'synthetic-vendor-invalid', NULL),
      ('synthetic-expense-null-relation', NULL, 'synthetic-vendor-a', NULL);
  `);
}

async function fixtureFingerprint(client: Client): Promise<string> {
  const result = await client.query(`SELECT md5(concat_ws('|',
      (SELECT count(*) FROM "CierreContable"),
      (SELECT count(*) FROM "PagoCuentaPorPagar"),
      (SELECT count(*) FROM "Servicios"),
      (SELECT count(*) FROM "VentaServicios"),
      (SELECT count(*) FROM "CompraServicio"),
      (SELECT count(*) FROM "GastoCompra"))) AS fingerprint`);
  return result.rows[0].fingerprint;
}

describe('aggregate accounting tenant preflight — PostgreSQL isolated fixture', () => {
  let client: Client | undefined;
  let schema: string | undefined;

  afterAll(async () => {
    if (!client) return;
    if (schema) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await client.end();
  });

  it('executes the exact aggregate queries read-only and partitions synthetic ownership cases', async () => {
    const connectionString = assertDisposableDatabase(process.env);
    client = new Client({ connectionString, application_name: 'accounting-tenant-preflight-fixture' });
    await client.connect();
    await assertAssignedDatabase(client);
    schema = `preflight_tenant_${randomUUID().replaceAll('-', '')}`;
    await createSyntheticFixture(client, schema);

    const before = await fixtureFingerprint(client);
    let readOnlyVerified = false;
    const statements: string[] = [];
    const guardedClient = {
      query: async (sql: string) => {
        statements.push(sql);
        if (!readOnlyVerified && (sql.startsWith('WITH') || sql.startsWith('SELECT'))) {
          const state = await client!.query('SHOW transaction_read_only');
          expect(state.rows[0].transaction_read_only).toBe('on');
          readOnlyVerified = true;
        }
        return client!.query(sql);
      },
    };

    const report = await runReadOnlyPreflight(guardedClient);
    const after = await fixtureFingerprint(client);

    expect(readOnlyVerified).toBe(true);
    expect(statements[0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(before).toBe(after);
    expect(report).toEqual({
      decision: 'NO-GO',
      blockers: 26,
      relationIssues: 3,
      schemaRemediation: [],
      results: {
        CierreContable: { ready: 1, missing: 1, ambiguous: 0, invalid: 1, scanned: 3, blockers: 2 },
        PagoCuentaPorPagar: { ready: 1, missing: 0, ambiguous: 0, invalid: 3, scanned: 4, blockers: 3 },
        Servicios: { ready: 2, missing: 1, ambiguous: 1, invalid: 4, scanned: 8, blockers: 6 },
        CompraServicio: { ready: 1, missing: 1, ambiguous: 1, invalid: 4, scanned: 7, blockers: 6 },
        GastoCompra: { ready: 1, missing: 0, ambiguous: 1, invalid: 5, scanned: 7, blockers: 6 },
      },
    });
    const results = report.results as Record<string, {
      scanned: number;
      ready: number;
      missing: number;
      ambiguous: number;
      invalid: number;
    }>;
    expect(results.CierreContable.scanned).toBe(3);
    expect(statements.every((sql) =>
      /^(BEGIN TRANSACTION|SELECT|WITH|ROLLBACK)/i.test(sql.trim())
      && !/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql),
    )).toBe(true);
    expect(Object.values(results).every((entry) =>
      entry.scanned === entry.ready + entry.missing + entry.ambiguous + entry.invalid,
    )).toBe(true);
  });
});
