import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

const sql = readFileSync('prisma/migrations/20261029000001_compra_servicio_tenant/migration.sql', 'utf8');
const schemas: string[] = [];
let db: Client;

/** @description Prepara relaciones históricas aisladas para ejecutar la migración real. */
async function fixture() {
  const name = `purchase_owner_${crypto.randomUUID().replaceAll('-', '')}`;
  await db.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}"`);
  schemas.push(name);
  await db.query(`CREATE TABLE tenants ("tenantId" text PRIMARY KEY);
    CREATE TABLE "Servicios" ("servicioId" text PRIMARY KEY, "tenantId" text);
    CREATE TABLE "Vendor" ("vendorId" text PRIMARY KEY, "tenantId" text);
    CREATE TABLE "CompraServicio" ("compraServicioId" text PRIMARY KEY, "servicioId" text NOT NULL, "proveedorId" text, "tenantId" text);
    INSERT INTO tenants VALUES ('a'), ('b');`);
}
beforeAll(async () => {
  db = new Client({ connectionString: assertDisposableDatabase(process.env), ssl: false });
  await db.connect();
  const result = await db.query(`SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"`);
  assertDisposableDatabaseIdentity(result.rows[0], process.env);
});
afterAll(async () => {
  if (!db) return;
  await db.query('ROLLBACK');
  for (const name of schemas) await db.query(`DROP SCHEMA "${name}" CASCADE`);
  await db.end();
});

describe('propiedad de compras de servicios', () => {
  it('asigna la empresa del servicio, verifica proveedor y permite repetir la migración', async () => {
    await fixture();
    await db.query(`INSERT INTO "Servicios" VALUES ('s', 'a'); INSERT INTO "Vendor" VALUES ('v', 'a');
      INSERT INTO "CompraServicio" VALUES ('p1', 's', 'v', NULL), ('p2', 's', NULL, 'a');`);
    await db.query(sql);
    await db.query(sql);
    expect((await db.query('SELECT "tenantId" FROM "CompraServicio" ORDER BY "compraServicioId"')).rows)
      .toEqual([{ tenantId: 'a' }, { tenantId: 'a' }]);
    await expect(db.query(`INSERT INTO "CompraServicio" VALUES ('p3', 's', NULL, NULL)`)).rejects.toThrow();
  });

  it.each(['sin-servicio', 'sin-empresa', 'proveedor-ausente', 'proveedor-cruzado', 'empresa-contradictoria'])(
    'rechaza %s sin modificar otras compras', async (kind) => {
      await fixture();
      await db.query(`INSERT INTO "Servicios" VALUES ('good', 'a'), ('bad', ${kind === 'sin-empresa' ? 'NULL' : "'b'"});
        INSERT INTO "Vendor" VALUES ('v', 'a');
        INSERT INTO "CompraServicio" VALUES ('good', 'good', NULL, NULL),
        ('bad', ${kind === 'sin-servicio' ? "'missing'" : "'bad'"}, ${kind === 'proveedor-ausente' ? "'missing'" : kind === 'proveedor-cruzado' ? "'v'" : 'NULL'}, ${kind === 'empresa-contradictoria' ? "'a'" : 'NULL'});`);
      await expect(db.query(sql)).rejects.toThrow(/CompraServicio/);
      await db.query('ROLLBACK');
      expect((await db.query(`SELECT "tenantId" FROM "CompraServicio" WHERE "compraServicioId" = 'good'`)).rows)
        .toEqual([{ tenantId: null }]);
    },
  );
});
