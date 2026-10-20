import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertDisposableDatabase, assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

const stages = ['expand', 'backfill', 'contract'];
const sql = stages.map((stage, index) => readFileSync(
  `prisma/migrations/2026101900000${index}_lista_precio_tenant_${stage}/migration.sql`, 'utf8',
));
const schemas: string[] = [];
let db: Client;

/** @description Creates a synthetic legacy schema, never business data. */
async function fixture(existing = false) {
  const name = `price_owner_${crypto.randomUUID().replaceAll('-', '')}`;
  await db.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}"`);
  schemas.push(name);
  await db.query(`
    CREATE TABLE tenants ("tenantId" TEXT PRIMARY KEY);
    CREATE TABLE "ListaPrecio" (id TEXT PRIMARY KEY${existing ? ', "tenantId" TEXT' : ''});
    CREATE TABLE "Cliente" ("listaPrecioId" TEXT, "tenantId" TEXT);
    CREATE TABLE "PuntoDeVenta" ("listaPrecioId" TEXT, "tenantId" TEXT);
    CREATE TABLE "Producto" (id TEXT PRIMARY KEY, "tenantId" TEXT);
    CREATE TABLE "PrecioProducto" ("listaPrecioId" TEXT, "productoId" TEXT);
    INSERT INTO tenants VALUES ('a'), ('b');
  `);
}

/** @description Applies the exact forward SQL without a substitute implementation. */
async function apply() {
  for (const stage of sql) await db.query(stage);
}

beforeAll(async () => {
  const connectionString = assertDisposableDatabase(process.env);
  db = new Client({ connectionString, ssl: false });
  await db.connect();
  const result = await db.query(`SELECT current_database() AS "databaseName",
    current_user AS "roleName", inet_server_port() AS "serverPort"`);
  assertDisposableDatabaseIdentity(result.rows[0], process.env);
});
afterAll(async () => {
  if (!db) return;
  await db.query('ROLLBACK');
  for (const name of schemas) await db.query(`DROP SCHEMA "${name}" CASCADE`);
  await db.end();
});

describe('ListaPrecio tenant ownership forward migration', () => {
  it('backfills unanimous client, POS and product evidence and is replayable', async () => {
    await fixture();
    await db.query(`INSERT INTO "ListaPrecio" VALUES ('client'), ('pos'), ('product');
      INSERT INTO "Cliente" VALUES ('client', 'a');
      INSERT INTO "PuntoDeVenta" VALUES ('pos', 'b');
      INSERT INTO "Producto" VALUES ('p', 'a');
      INSERT INTO "PrecioProducto" VALUES ('product', 'p');`);
    await apply();
    await apply();
    expect((await db.query('SELECT * FROM "ListaPrecio" ORDER BY id')).rows).toEqual([
      { id: 'client', tenantId: 'a' }, { id: 'pos', tenantId: 'b' },
      { id: 'product', tenantId: 'a' },
    ]);
    await expect(db.query(`INSERT INTO "ListaPrecio" VALUES ('null', NULL)`)).rejects.toThrow();
    await expect(db.query(`INSERT INTO "ListaPrecio" VALUES ('bad', 'missing')`)).rejects.toThrow();
  });

  it('preserves a valid existing owner without references', async () => {
    await fixture(true);
    await db.query(`INSERT INTO "ListaPrecio" VALUES ('owned', 'a')`);
    await apply();
    expect((await db.query('SELECT "tenantId" FROM "ListaPrecio"')).rows).toEqual([{ tenantId: 'a' }]);
  });

  it.each(['orphan', 'conflict', 'invalid', 'existing-conflict', 'broken-product'])(
    'fails closed without partial backfill for %s', async (kind) => {
      await fixture(true);
      await db.query(`INSERT INTO "ListaPrecio" VALUES ('good', NULL), ('bad', ${kind === 'existing-conflict' ? "'a'" : 'NULL'});
        INSERT INTO "Cliente" VALUES ('good', 'a');`);
      if (kind === 'conflict') await db.query(`INSERT INTO "Cliente" VALUES ('bad', 'a'), ('bad', 'b')`);
      if (kind === 'existing-conflict') await db.query(`INSERT INTO "Cliente" VALUES ('bad', 'b')`);
      if (kind === 'invalid') await db.query(`INSERT INTO "Cliente" VALUES ('bad', 'missing')`);
      if (kind === 'broken-product') await db.query(`INSERT INTO "PrecioProducto" VALUES ('bad', 'missing')`);
      await db.query(sql[0]);
      const before = (await db.query('SELECT * FROM "ListaPrecio" ORDER BY id')).rows;
      await expect(db.query(sql[1])).rejects.toThrow(/Cannot backfill ListaPrecio/);
      await db.query('ROLLBACK');
      expect((await db.query('SELECT * FROM "ListaPrecio" ORDER BY id')).rows).toEqual(before);
    },
  );

  it.each(['type', 'fk', 'index'])('rejects incompatible existing %s instead of masking drift', async (kind) => {
    await fixture(true);
    if (kind === 'type') await db.query('ALTER TABLE "ListaPrecio" ALTER "tenantId" TYPE INTEGER USING NULL');
    if (kind === 'fk') await db.query(`CREATE TABLE wrong ("tenantId" TEXT PRIMARY KEY);
      ALTER TABLE "ListaPrecio" ADD CONSTRAINT "ListaPrecio_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES wrong("tenantId")`);
    if (kind === 'index') await db.query('CREATE INDEX "ListaPrecio_tenantId_idx" ON "ListaPrecio" (id)');
    await expect(apply()).rejects.toThrow(/ListaPrecio/);
    await db.query('ROLLBACK');
  });
});
