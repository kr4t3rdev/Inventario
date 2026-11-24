import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'prisma/migrations/20261123000000_mobile_product_sync_journal/migration.sql',
);
const schemaName = `mobile_sync_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const concurrentClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
let isConnected = false;
let isConcurrentClientConnected = false;

interface ChangeRow {
  tenantId: string;
  sequence: string;
  productId: string;
  operation: string;
}

describe('mobile product sync journal triggers', () => {
  beforeAll(async () => {
    await client.connect();
    isConnected = true;
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(`
      CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY);
      CREATE TABLE "Producto" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "nombre" TEXT NOT NULL
      );
      CREATE TABLE "StockUbicacion" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "productoId" TEXT NOT NULL,
        "cantidad" INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE
      );
    `);
    await client.query(await readFile(migrationPath, 'utf8'));
    await concurrentClient.connect();
    isConcurrentClientConnected = true;
    await concurrentClient.query(`SET search_path TO "${schemaName}"`);
  });

  afterAll(async () => {
    if (isConnected) {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await client.end();
    }
    if (isConcurrentClientConnected) {
      await concurrentClient.end();
    }
  });

  it('records product and stock changes in tenant-local transactional order', async () => {
    await client.query(`INSERT INTO "tenants" ("tenantId") VALUES ('tenant-a'), ('tenant-b')`);
    await client.query(`
      INSERT INTO "Producto" ("id", "tenantId", "nombre")
      VALUES ('product-a', 'tenant-a', 'Arroz'), ('product-b', 'tenant-b', 'Frijol')
    `);
    await client.query(`
      UPDATE "Producto" SET "nombre" = 'Arroz integral' WHERE "id" = 'product-a'
    `);
    await client.query(`
      INSERT INTO "StockUbicacion" ("id", "tenantId", "productoId", "cantidad")
      VALUES ('stock-a', 'tenant-a', 'product-a', 10)
    `);
    await client.query(`
      UPDATE "StockUbicacion" SET "cantidad" = 8 WHERE "id" = 'stock-a'
    `);
    await client.query(`DELETE FROM "StockUbicacion" WHERE "id" = 'stock-a'`);
    await client.query(`DELETE FROM "Producto" WHERE "id" = 'product-a'`);

    const { rows } = await client.query<ChangeRow>(`
      SELECT "tenantId", "sequence"::text, "productId", "operation"
      FROM "MobileProductSyncChange"
      ORDER BY "tenantId", "sequence"
    `);

    expect(rows.filter((row) => row.tenantId === 'tenant-a')).toEqual([
      { tenantId: 'tenant-a', sequence: '1', productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '2', productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '3', productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '4', productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '5', productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '6', productId: 'product-a', operation: 'DELETE' },
    ]);
    expect(rows.filter((row) => row.tenantId === 'tenant-b')).toEqual([
      { tenantId: 'tenant-b', sequence: '1', productId: 'product-b', operation: 'UPSERT' },
    ]);

    await client.query(`
      INSERT INTO "Producto" ("id", "tenantId", "nombre")
      VALUES ('product-cascade', 'tenant-a', 'Cascada');
      INSERT INTO "StockUbicacion" ("id", "tenantId", "productoId", "cantidad")
      VALUES ('stock-cascade', 'tenant-a', 'product-cascade', 3);
      DELETE FROM "Producto" WHERE "id" = 'product-cascade';
    `);
    const cascadeRows = await client.query<ChangeRow>(`
      SELECT "tenantId", "sequence"::text, "productId", "operation"
      FROM "MobileProductSyncChange"
      WHERE "tenantId" = 'tenant-a' AND "productId" = 'product-cascade'
      ORDER BY "sequence"
    `);
    expect(cascadeRows.rows).toEqual([
      { tenantId: 'tenant-a', sequence: '7', productId: 'product-cascade', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '8', productId: 'product-cascade', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: '9', productId: 'product-cascade', operation: 'DELETE' },
    ]);
  });

  it('rolls the journal entry back with its product mutation', async () => {
    await client.query(`INSERT INTO "tenants" ("tenantId") VALUES ('tenant-c')`);
    await client.query('BEGIN');
    await client.query(`INSERT INTO "Producto" ("id", "tenantId", "nombre")
      VALUES ('rolled-back', 'tenant-c', 'Temporal')`);
    await client.query('ROLLBACK');

    const { rows } = await client.query(
      `SELECT 1 FROM "MobileProductSyncChange" WHERE "tenantId" = 'tenant-c'`,
    );
    expect(rows).toHaveLength(0);
    const cursor = await client.query(
      `SELECT 1 FROM "MobileProductSyncCursor" WHERE "tenantId" = 'tenant-c'`,
    );
    expect(cursor.rows).toHaveLength(0);
  });

  it('allocates distinct tenant-local sequences for concurrent product writes', async () => {
    await client.query(`INSERT INTO "tenants" ("tenantId") VALUES ('tenant-race')`);

    await Promise.all([
      client.query(`
        INSERT INTO "Producto" ("id", "tenantId", "nombre")
        VALUES ('product-race-a', 'tenant-race', 'A')
      `),
      concurrentClient.query(`
        INSERT INTO "Producto" ("id", "tenantId", "nombre")
        VALUES ('product-race-b', 'tenant-race', 'B')
      `),
    ]);

    const { rows } = await client.query<ChangeRow>(`
      SELECT "tenantId", "sequence"::text, "productId", "operation"
      FROM "MobileProductSyncChange"
      WHERE "tenantId" = 'tenant-race'
      ORDER BY "sequence"
    `);
    expect(rows.map((row) => row.sequence)).toEqual(['1', '2']);
    expect(rows.map((row) => row.productId).sort()).toEqual(['product-race-a', 'product-race-b']);
    expect(rows.every((row) => row.operation === 'UPSERT')).toBe(true);
  });
});
