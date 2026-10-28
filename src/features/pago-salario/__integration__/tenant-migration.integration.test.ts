import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertDisposableDatabase, assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

const migration = readFileSync(
  'prisma/migrations/20261029000000_pagosalario_tenant/migration.sql', 'utf8',
);
const schemas: string[] = [];
let db: Client;

/** @description Crea un esquema histórico aislado para probar la migración real. */
async function fixture(existing = false) {
  const name = `payroll_owner_${crypto.randomUUID().replaceAll('-', '')}`;
  await db.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}"`);
  schemas.push(name);
  await db.query(`
    CREATE TABLE tenants ("tenantId" text PRIMARY KEY);
    CREATE TABLE "Empleado" ("empleadoId" text PRIMARY KEY, "tenantId" text);
    CREATE TABLE "Pagosalario" ("pgId" text PRIMARY KEY, "empleadoId" text NOT NULL${existing ? ', "tenantId" text' : ''});
    INSERT INTO tenants VALUES ('a'), ('b');
  `);
}

beforeAll(async () => {
  db = new Client({ connectionString: assertDisposableDatabase(process.env), ssl: false });
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

describe('migración de empresa en pagos de salario', () => {
  it('asigna la empresa del empleado y conserva asignaciones válidas', async () => {
    await fixture(true);
    await db.query(`INSERT INTO "Empleado" VALUES ('e1', 'a'), ('e2', 'b');
      INSERT INTO "Pagosalario" VALUES ('p1', 'e1', NULL), ('p2', 'e2', 'b');`);
    await db.query(migration);
    expect((await db.query('SELECT "pgId", "tenantId" FROM "Pagosalario" ORDER BY "pgId"')).rows)
      .toEqual([{ pgId: 'p1', tenantId: 'a' }, { pgId: 'p2', tenantId: 'b' }]);
    await db.query(migration);
    await expect(db.query(`INSERT INTO "Pagosalario" VALUES ('p3', 'e1', NULL)`)).rejects.toThrow();
    await expect(db.query(`INSERT INTO "Pagosalario" VALUES ('p4', 'e1', 'missing')`)).rejects.toThrow();
  });

  it.each(['sin-empleado', 'sin-empresa', 'empresa-invalida', 'conflicto'])(
    'rechaza %s sin asignaciones parciales', async (kind) => {
      await fixture(true);
      await db.query(`INSERT INTO "Empleado" VALUES ('good', 'a'), ('bad', ${kind === 'sin-empresa' ? 'NULL' : kind === 'empresa-invalida' ? "'missing'" : "'b'"});
        INSERT INTO "Pagosalario" VALUES ('good', 'good', NULL), ('bad', ${kind === 'sin-empleado' ? "'missing'" : "'bad'"}, ${kind === 'conflicto' ? "'a'" : 'NULL'});`);
      await expect(db.query(migration)).rejects.toThrow(/Pagosalario/);
      await db.query('ROLLBACK');
      expect((await db.query(`SELECT "tenantId" FROM "Pagosalario" WHERE "pgId" = 'good'`)).rows)
        .toEqual([{ tenantId: null }]);
    },
  );
});
