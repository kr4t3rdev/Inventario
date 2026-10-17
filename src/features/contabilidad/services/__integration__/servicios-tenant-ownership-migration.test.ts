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
  'prisma/migrations/20261014220000_servicios_tenant_ownership/migration.sql',
);
const expectedMigrationSha256 =
  'a58a5b9e714e7b5367b08bb944959f11c029efa8939038e58da53c067c50db50';
const migrationSql = readFileSync(migrationPath, 'utf8');
const schemaPrefix = `servicios_owner_${process.pid}_${Date.now()}`;
const createdSchemas: string[] = [];
let client: Client;

/** @description Validate the explicitly selected local disposable database. */
function getDatabaseUrl(): URL {
  const url = new URL(assertDisposableDatabase(process.env));
  if (
    url.hostname !== '127.0.0.1' || !url.port || url.search || url.hash
  ) {
    throw new Error('Refusing non-approved local disposable PostgreSQL identity.');
  }
  return url;
}

/** @description Create an isolated schema representing the required legacy relations. */
async function createFixture(options: {
  name: string;
  existingTenantColumn?: boolean;
  vendorColumn?: boolean;
}): Promise<string> {
  const schema = `${schemaPrefix}_${options.name}`;
  if (Buffer.byteLength(schema, 'utf8') > 63) throw new Error('Fixture schema exceeds PostgreSQL limit.');
  await client.query(`CREATE SCHEMA "${schema}"`);
  createdSchemas.push(schema);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY);
    CREATE TABLE "Vendor" ("vendorId" TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "Servicios" (
      "servicioId" TEXT PRIMARY KEY
      ${options.existingTenantColumn ? ', "tenantId" TEXT' : ''}
      ${options.vendorColumn ? ', "vendorId" TEXT' : ''}
    );
    CREATE TABLE "VentaServicios" (
      "ventaServicioId" TEXT PRIMARY KEY,
      "servicioId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL
    );
    INSERT INTO "tenants" VALUES ('tenant-a'), ('tenant-b');
  `);
  return schema;
}

/** @description Select the independent fixture schema for the next scenario. */
async function setSchema(schema: string): Promise<void> {
  await client.query(`SET search_path TO "${schema}"`);
}

/** @description Assert the migration's reviewed bytes and execute that exact SQL. */
async function applyMigration(): Promise<void> {
  expect(createHash('sha256').update(migrationSql).digest('hex')).toBe(expectedMigrationSha256);
  await client.query(migrationSql);
}

/** @description Capture columns and service rows to prove migration rollback. */
async function snapshot(): Promise<unknown> {
  const columns = await client.query(`
    SELECT attname, attnotnull FROM pg_attribute
    WHERE attrelid = '"Servicios"'::regclass AND attnum > 0 AND NOT attisdropped
    ORDER BY attnum
  `);
  const services = await client.query('SELECT to_jsonb(s) FROM "Servicios" s ORDER BY 1');
  const indexes = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = current_schema() AND tablename = 'Servicios' ORDER BY indexname
  `);
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid = '"Servicios"'::regclass ORDER BY conname
  `);
  return { columns: columns.rows, services: services.rows, indexes: indexes.rows, constraints: constraints.rows };
}

/** @description Verify failed ownership inference rolls back all schema and row changes. */
async function expectRejectedAndRolledBack(schema: string): Promise<void> {
  await setSchema(schema);
  const before = await snapshot();
  await expect(applyMigration()).rejects.toThrow(/Cannot backfill Servicios\.tenantId/);
  await client.query('ROLLBACK');
  expect(await snapshot()).toEqual(before);
}

beforeAll(async () => {
  const url = getDatabaseUrl();
  client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  const identity = await client.query(`
    SELECT current_database() AS database_name, current_user AS role_name,
      inet_server_port() AS server_port
  `);
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

describe('Servicios tenant ownership migration', () => {
  it('backfills unanimous existing, vendor, and linked-sale ownership', async () => {
    const schema = await createFixture({ name: 'valid', existingTenantColumn: true, vendorColumn: true });
    await setSchema(schema);
    await client.query(`
      INSERT INTO "Vendor" VALUES ('vendor-a', 'tenant-a');
      INSERT INTO "Servicios" VALUES ('existing-owner', 'tenant-a', NULL), ('vendor-owner', NULL, 'vendor-a'), ('sale-owner', NULL, NULL);
      INSERT INTO "VentaServicios" VALUES ('sale-1', 'sale-owner', 'tenant-a');
    `);

    await applyMigration();

    const result = await client.query('SELECT "servicioId", "tenantId" FROM "Servicios" ORDER BY 1');
    expect(result.rows).toEqual([
      { servicioId: 'existing-owner', tenantId: 'tenant-a' },
      { servicioId: 'sale-owner', tenantId: 'tenant-a' },
      { servicioId: 'vendor-owner', tenantId: 'tenant-a' },
    ]);
    const constraints = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = '"Servicios"'::regclass AND conname = 'Servicios_tenantId_fkey'
    `);
    expect(constraints.rows[0]?.definition).toContain('FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId")');
  });

  it('fails closed and rolls back when an unlinked service has no owner', async () => {
    const schema = await createFixture({ name: 'unmapped' });
    await setSchema(schema);
    await client.query(`INSERT INTO "Servicios" VALUES ('unmapped')`);
    await expectRejectedAndRolledBack(schema);
  });

  it('fails closed and rolls back when linked sales disagree on tenant', async () => {
    const schema = await createFixture({ name: 'conflicting-sales' });
    await setSchema(schema);
    await client.query(`
      INSERT INTO "Servicios" VALUES ('shared-service');
      INSERT INTO "VentaServicios" VALUES
        ('sale-a', 'shared-service', 'tenant-a'), ('sale-b', 'shared-service', 'tenant-b');
    `);
    await expectRejectedAndRolledBack(schema);
  });

  it('fails closed and rolls back when Vendor conflicts with linked-sale ownership', async () => {
    const schema = await createFixture({ name: 'conflicting-vendor', vendorColumn: true });
    await setSchema(schema);
    await client.query(`
      INSERT INTO "Vendor" VALUES ('vendor-b', 'tenant-b');
      INSERT INTO "Servicios" VALUES ('service', 'vendor-b');
      INSERT INTO "VentaServicios" VALUES ('sale-a', 'service', 'tenant-a');
    `);
    await expectRejectedAndRolledBack(schema);
  });

  it('fails closed and rolls back when a linked sale is orphaned', async () => {
    const schema = await createFixture({ name: 'orphan' });
    await setSchema(schema);
    await client.query(`INSERT INTO "VentaServicios" VALUES ('orphan-sale', 'missing-service', 'tenant-a')`);
    await expectRejectedAndRolledBack(schema);
  });
});
