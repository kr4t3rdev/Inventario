import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../../scripts/ci/disposable-database.mjs';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261014180000_accounting_obligation_tenant_ownership/migration.sql',
);
const expectedMigrationSha256 =
  '30cfb5c0e40c1cfe5fc22ceeb6e87f57a54ea0f9a19a47ad6b5de33e09b616a9';
const migrationSql = readFileSync(migrationPath, 'utf8');
const schemaPrefix = `owner_backfill_${process.pid}_${Date.now()}`;
const createdSchemas: string[] = [];
const tableNames = [
  'CompraProducto',
  'CompraDocumento',
  'CompraDocumentoItem',
  'CuentaPorPagar',
  'DeudaCash',
  'GastoCompra',
  'GastosDE',
  'Producto',
  'Vendor',
  'tenants',
];

let client: Client;

/**
 * @description Validate the explicit disposable database URL and create a session client.
 */
function getDatabaseUrl(): URL {
  const url = new URL(assertDisposableDatabase(process.env));
  if (
    url.hostname !== '127.0.0.1' || !url.port || url.search || url.hash
  ) {
    throw new Error('Refusing non-approved local disposable PostgreSQL identity.');
  }
  return url;
}

/**
 * @description Create a uniquely named schema with only the historical relations used by the SQL.
 * @param {string} schema - Isolated schema name.
 * @param {boolean} includeOwnershipColumns - Simulate an already-partially-populated schema.
 */
async function createFixtureSchema(schema: string, includeOwnershipColumns = false): Promise<void> {
  await client.query(`CREATE SCHEMA "${schema}"`);
  createdSchemas.push(schema);
  await client.query(`SET search_path TO "${schema}"`);
  const ownershipColumns = includeOwnershipColumns ? ', "tenantId" TEXT' : '';
  await client.query(`
    CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY);
    CREATE TABLE "Producto" ("id" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "Vendor" ("vendorId" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "GastoCompra" (
      "gastoCompraId" TEXT PRIMARY KEY, "tenantId" TEXT, "productoId" TEXT, "vendorId" TEXT
    );
    CREATE TABLE "GastosDE" (
      "gastosDEId" TEXT PRIMARY KEY, "tenantId" TEXT, "proveedorId" TEXT
    );
    CREATE TABLE "DeudaCash" (
      "deudaCashId" TEXT PRIMARY KEY, "tenantId" TEXT, "proveedorId" TEXT,
      "cuentaPorPagarId" TEXT
    );
    CREATE TABLE "CuentaPorPagar" (
      "cuentaPorPagarId" TEXT PRIMARY KEY, "proveedorId" TEXT, "gastoCompraId" TEXT,
      "gastosDEId" TEXT${ownershipColumns}
    );
    CREATE TABLE "CompraProducto" (
      "compraProductoId" TEXT PRIMARY KEY, "productoId" TEXT, "proveedorId" TEXT,
      "gastoCompraId" TEXT, "cuentaPorPagarId" TEXT${ownershipColumns}
    );
    CREATE TABLE "CompraDocumento" (
      "compraDocumentoId" TEXT PRIMARY KEY, "cuentaPorPagarId" TEXT, "tenantId" TEXT,
      "gastoCompraId" TEXT, "proveedorId" TEXT
    );
    CREATE TABLE "CompraDocumentoItem" (
      "compraDocumentoItemId" TEXT PRIMARY KEY, "compraDocumentoId" TEXT,
      "tenantId" TEXT, "productoId" TEXT
    );
  `);
  await seedBaseRows();
}

/**
 * @description Seed two isolated tenants with matching product and vendor authorities.
 */
async function seedBaseRows(): Promise<void> {
  await client.query(`
    INSERT INTO "tenants" VALUES ('tenant-a'), ('tenant-b');
    INSERT INTO "Producto" VALUES ('product-a', 'tenant-a'), ('product-b', 'tenant-b');
    INSERT INTO "Vendor" VALUES ('vendor-a', 'tenant-a'), ('vendor-b', 'tenant-b');
  `);
}

/**
 * @description Set the active fixture schema for the next fixture and migration commands.
 * @param {string} schema - Isolated schema name.
 */
async function setSchema(schema: string): Promise<void> {
  await client.query(`SET search_path TO "${schema}"`);
}

/**
 * @description Capture all fixture rows, relevant table columns, constraints, and indexes.
 */
async function captureSnapshot(): Promise<Record<string, unknown>> {
  const rows: Record<string, unknown> = {};
  for (const tableName of tableNames) {
    const result = await client.query(`SELECT to_jsonb(row_value) AS row_value
      FROM "${tableName}" AS row_value ORDER BY 1`);
    rows[tableName] = result.rows.map((row) => row.row_value);
  }
  const columns = await client.query(`
    SELECT c.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = current_schema() AND c.relkind = 'r'
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `);
  const constraints = await client.query(`
    SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE connamespace = current_schema()::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `);
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = current_schema() ORDER BY tablename, indexname
  `);
  return {
    rows,
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
}

/**
 * @description Apply the migration only after asserting its reviewed immutable content hash.
 */
async function applyExactMigration(): Promise<void> {
  const actualHash = createHash('sha256').update(migrationSql).digest('hex');
  expect(actualHash).toBe(expectedMigrationSha256);
  await client.query(migrationSql);
}

/**
 * @description Verify a failed migration fully rolled back its row and catalog changes.
 * @param {string} schema - Isolated fixture schema.
 */
async function expectPhysicalRollback(schema: string): Promise<void> {
  await setSchema(schema);
  const before = await captureSnapshot();
  await expect(applyExactMigration()).rejects.toThrow(/Cannot assign tenant to/);
  // A SQL error inside BEGIN leaves the session's transaction aborted; issue the
  // explicit rollback before inspecting the post-failure physical state.
  await client.query('ROLLBACK');
  const after = await captureSnapshot();
  expect(after).toEqual(before);
}

/**
 * @description Create one uniquely named schema for each independent scenario.
 * @param {string} suffix - Short fixture label.
 * @returns {string} Safe schema name.
 */
function makeSchemaName(suffix: string): string {
  const schema = `${schemaPrefix}_${suffix}`;
  if (Buffer.byteLength(schema, 'utf8') > 63) throw new Error('Fixture schema name exceeds PostgreSQL limit.');
  return schema;
}

beforeAll(async () => {
  getDatabaseUrl();
  client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  const identity = await client.query(`
    SELECT current_database() AS database_name, current_user AS role_name,
      inet_server_port() AS server_port
  `);
  const url = getDatabaseUrl();
  assertDisposableDatabaseIdentity({
    databaseName: identity.rows[0]?.database_name,
    roleName: identity.rows[0]?.role_name,
    serverPort: identity.rows[0]?.server_port,
  }, process.env);
  expect(url.hostname).toBe('127.0.0.1');
  expect(url.port).toMatch(/^\d+$/);
  expect(createHash('sha256').update(migrationSql).digest('hex')).toBe(expectedMigrationSha256);
}, 30000);

afterAll(async () => {
  if (!client) return;
  for (const schema of [...createdSchemas].reverse()) {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await client.end();
});

describe('accounting obligation tenant ownership migration historical fixtures', () => {
  it('backfills CompraProducto, CuentaPorPagar, and direct/document ownership sources', async () => {
    const schema = makeSchemaName('valid');
    await createFixtureSchema(schema);
    await setSchema(schema);
    await client.query(`
      INSERT INTO "GastoCompra" VALUES ('gc-a', 'tenant-a', 'product-a', 'vendor-a');
      INSERT INTO "GastosDE" VALUES ('gde-a', 'tenant-a', 'vendor-a');
      INSERT INTO "DeudaCash" VALUES ('dc-a', 'tenant-a', 'vendor-a', 'cxp-cash');
      INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId", "gastoCompraId")
        VALUES ('cxp-cp', 'vendor-a', NULL), ('cxp-gc', 'vendor-a', 'gc-a');
      INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId", "gastosDEId")
        VALUES ('cxp-gde', 'vendor-a', 'gde-a');
      INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId")
        VALUES ('cxp-cash', 'vendor-a'), ('cxp-doc-no-gc', 'vendor-a'), ('cxp-doc-gc', 'vendor-a');
      INSERT INTO "CompraProducto" ("compraProductoId", "productoId", "proveedorId", "cuentaPorPagarId")
        VALUES ('cp-a', 'product-a', 'vendor-a', 'cxp-cp');
      INSERT INTO "CompraDocumento" VALUES
        ('doc-no-gc', 'cxp-doc-no-gc', 'tenant-a', NULL, 'vendor-a'),
        ('doc-with-gc', 'cxp-doc-gc', 'tenant-a', 'gc-a', 'vendor-a');
      INSERT INTO "CompraDocumentoItem" VALUES
        ('item-no-gc', 'doc-no-gc', 'tenant-a', 'product-a'),
        ('item-with-gc', 'doc-with-gc', 'tenant-a', 'product-a');
    `);

    await applyExactMigration();

    const cp = await client.query(`SELECT "tenantId" FROM "CompraProducto" WHERE "compraProductoId" = 'cp-a'`);
    expect(cp.rows[0].tenantId).toBe('tenant-a');
    const cxp = await client.query(`SELECT "cuentaPorPagarId", "tenantId" FROM "CuentaPorPagar" ORDER BY 1`);
    expect(cxp.rows).toEqual([
      { cuentaPorPagarId: 'cxp-cash', tenantId: 'tenant-a' },
      { cuentaPorPagarId: 'cxp-cp', tenantId: 'tenant-a' },
      { cuentaPorPagarId: 'cxp-doc-gc', tenantId: 'tenant-a' },
      { cuentaPorPagarId: 'cxp-doc-no-gc', tenantId: 'tenant-a' },
      { cuentaPorPagarId: 'cxp-gc', tenantId: 'tenant-a' },
      { cuentaPorPagarId: 'cxp-gde', tenantId: 'tenant-a' },
    ]);
    const foreignKeys = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace AND contype = 'f'
      ORDER BY conname
    `);
    expect(foreignKeys.rows.map((row) => row.conname)).toEqual([
      'CompraProducto_tenantId_fkey', 'CuentaPorPagar_tenantId_fkey',
    ]);
  });

  it('preserves already-correct ownership values without replacing them', async () => {
    const schema = makeSchemaName('preserve');
    await createFixtureSchema(schema, true);
    await setSchema(schema);
    await client.query(`
      INSERT INTO "CuentaPorPagar" VALUES ('cxp-preserve', 'vendor-a', NULL, NULL, 'tenant-a');
      INSERT INTO "CompraProducto" VALUES ('cp-preserve', 'product-a', 'vendor-a', NULL,
        'cxp-preserve', 'tenant-a');
      CREATE FUNCTION reject_existing_owner_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'pre-existing ownership row must not be updated';
      END;
      $$;
      CREATE TRIGGER preserve_cxp_owner BEFORE UPDATE ON "CuentaPorPagar"
        FOR EACH ROW WHEN (OLD."tenantId" IS NOT NULL)
        EXECUTE FUNCTION reject_existing_owner_update();
      CREATE TRIGGER preserve_cp_owner BEFORE UPDATE ON "CompraProducto"
        FOR EACH ROW WHEN (OLD."tenantId" IS NOT NULL)
        EXECUTE FUNCTION reject_existing_owner_update();
    `);
    await applyExactMigration();
    const result = await client.query(`
      SELECT (SELECT "tenantId" FROM "CuentaPorPagar" WHERE "cuentaPorPagarId" = 'cxp-preserve') AS cxp,
        (SELECT "tenantId" FROM "CompraProducto" WHERE "compraProductoId" = 'cp-preserve') AS cp
    `);
    expect(result.rows[0]).toEqual({ cxp: 'tenant-a', cp: 'tenant-a' });
  });

  it.each([
    ['unowned payable', async () => {
      await client.query(`INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('cxp-x')`);
    }],
    ['conflicting payable sources', async () => {
      await client.query(`
        INSERT INTO "GastosDE" VALUES ('gde-x', 'tenant-b', 'vendor-b');
        INSERT INTO "DeudaCash" VALUES ('dc-x', 'tenant-a', 'vendor-a', 'cxp-x');
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastosDEId") VALUES ('cxp-x', 'gde-x');
      `);
    }],
    ['orphaned payable source', async () => {
      await client.query(`INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastosDEId")
        VALUES ('cxp-x', 'missing-gde')`);
    }],
    ['null legacy purchase expense tenant', async () => {
      await client.query(`
        INSERT INTO "GastoCompra" VALUES ('gc-x', NULL, 'product-a', 'vendor-a');
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId") VALUES ('cxp-x', 'gc-x');
      `);
    }],
    ['purchase document with no details', async () => {
      await client.query(`
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId") VALUES ('cxp-x', 'vendor-a');
        INSERT INTO "CompraDocumento" VALUES ('doc-x', 'cxp-x', 'tenant-a', NULL, 'vendor-a');
      `);
    }],
    ['purchase document detail tenant mismatch', async () => {
      await client.query(`
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId") VALUES ('cxp-x', 'vendor-a');
        INSERT INTO "CompraDocumento" VALUES ('doc-x', 'cxp-x', 'tenant-a', NULL, 'vendor-a');
        INSERT INTO "CompraDocumentoItem" VALUES ('item-x', 'doc-x', 'tenant-b', 'product-a');
      `);
    }],
    ['purchase document detail product tenant mismatch', async () => {
      await client.query(`
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId") VALUES ('cxp-x', 'vendor-a');
        INSERT INTO "CompraDocumento" VALUES ('doc-x', 'cxp-x', 'tenant-a', NULL, 'vendor-a');
        INSERT INTO "CompraDocumentoItem" VALUES ('item-x', 'doc-x', 'tenant-a', 'product-b');
      `);
    }],
    ['nested purchase expense conflicts with document owner', async () => {
      await client.query(`
        INSERT INTO "GastoCompra" VALUES ('gc-x', 'tenant-b', 'product-b', 'vendor-b');
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId") VALUES ('cxp-x', 'vendor-a');
        INSERT INTO "CompraDocumento" VALUES ('doc-x', 'cxp-x', 'tenant-a', 'gc-x', 'vendor-a');
        INSERT INTO "CompraDocumentoItem" VALUES ('item-x', 'doc-x', 'tenant-a', 'product-a');
      `);
    }],
    ['unowned purchase item parent', async () => {
      await client.query(`
        INSERT INTO "CompraProducto" ("compraProductoId", "productoId", "proveedorId")
          VALUES ('cp-x', 'missing-product', 'missing-vendor');
      `);
    }],
    ['pre-existing payable owner conflicts', async () => {
      await client.query(`
        INSERT INTO "GastosDE" VALUES ('gde-x', 'tenant-a', 'vendor-a');
        INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "proveedorId", "gastosDEId", "tenantId")
          VALUES ('cxp-x', 'vendor-a', 'gde-x', 'tenant-b');
      `);
    }],
  ])('rejects %s with physical row and catalog rollback', async (_label, seed) => {
    const schema = makeSchemaName(`invalid_${createdSchemas.length}`);
    await createFixtureSchema(schema, _label === 'pre-existing payable owner conflicts');
    await setSchema(schema);
    await seed();
    await expectPhysicalRollback(schema);
  });
});
