/**
 * @description Verifica el guard SQL real de R5 con tablas temporales aisladas.
 * @returns Evidencia PostgreSQL de conservación/backfill y rechazo de procedencia inválida.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const sql = readFileSync(
  'prisma/migrations/20260929000000_r5_formal_schema_dependencies/migration.sql', 'utf8',
);
const start = sql.indexOf('ALTER TABLE "CompraProducto" ADD COLUMN');
const end = sql.indexOf('CREATE INDEX IF NOT EXISTS "CompraProducto_tenantId_idx"', start);
if (start < 0 || end < 0) throw new Error('Bloque de procedencia R5 no encontrado');
const purchaseBlock = sql.slice(start, end);

interface PurchaseCase {
  name: string;
  tenant: string;
  source: string;
  setup?: string;
  accepted: boolean;
}

/**
 * @description Ejecuta el bloque de migración dentro de una sesión con tablas temporales.
 * @param {PurchaseCase} scenario - Caso de procedencia con datos sintéticos.
 * @returns {ReturnType<typeof spawnSync>} Resultado del proceso PostgreSQL.
 */
function runScenario(scenario: PurchaseCase) {
  const target = new URL(process.env.DATABASE_URL_TEST ?? '');
  const script = `
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_temp, public;
CREATE TEMP TABLE "Producto" ("id" TEXT, "tenantId" TEXT);
CREATE TEMP TABLE "Vendor" ("vendorId" TEXT, "tenantId" TEXT);
CREATE TEMP TABLE "GastoCompra" ("gastoCompraId" TEXT, "tenantId" TEXT);
CREATE TEMP TABLE "CompraProducto" (
  "compraProductoId" TEXT, "tenantId" TEXT, "gastoCompraId" TEXT,
  "productoId" TEXT, "proveedorId" TEXT
);
INSERT INTO "Producto" VALUES ('product', 'tenant-a');
INSERT INTO "Vendor" VALUES ('vendor', 'tenant-a');
INSERT INTO "GastoCompra" VALUES ('source', 'tenant-a');
INSERT INTO "CompraProducto" VALUES (
  'purchase', ${scenario.tenant}, ${scenario.source}, 'product', 'vendor'
);
${scenario.setup ?? ''}
${purchaseBlock}
SELECT "tenantId" FROM "CompraProducto";
ROLLBACK;
`;
  return spawnSync('psql', ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    encoding: 'utf8', input: script, timeout: 20_000,
    env: {
      ...process.env,
      PGHOST: target.hostname, PGPORT: target.port || '5432',
      PGDATABASE: target.pathname.slice(1), PGUSER: decodeURIComponent(target.username),
      PGPASSWORD: decodeURIComponent(target.password), PGOPTIONS: '',
    },
  });
}

const cases: PurchaseCase[] = [
  { name: 'conserva tenant validado sin GastoCompra', tenant: "'tenant-a'",
    source: 'NULL', accepted: true },
  { name: 'backfill desde GastoCompra cuando tenant es nulo', tenant: 'NULL',
    source: "'source'", accepted: true },
  { name: 'conserva tenant coherente con fuente existente', tenant: "'tenant-a'",
    source: "'source'", accepted: true },
  { name: 'rechaza tenant nulo sin fuente', tenant: 'NULL', source: 'NULL', accepted: false },
  { name: 'rechaza referencia GastoCompra ausente', tenant: "'tenant-a'",
    source: "'absent'", accepted: false },
  { name: 'rechaza fuente con tenant nulo', tenant: 'NULL', source: "'source'",
    setup: 'UPDATE "GastoCompra" SET "tenantId" = NULL;', accepted: false },
  { name: 'rechaza fuente existente de otro tenant', tenant: "'tenant-b'",
    source: "'source'", accepted: false },
  { name: 'rechaza producto de otro tenant sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'UPDATE "Producto" SET "tenantId" = \'tenant-b\';', accepted: false },
  { name: 'rechaza proveedor de otro tenant sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'UPDATE "Vendor" SET "tenantId" = \'tenant-b\';', accepted: false },
  { name: 'rechaza producto ausente sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'DELETE FROM "Producto";', accepted: false },
  { name: 'rechaza proveedor ausente sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'DELETE FROM "Vendor";', accepted: false },
  { name: 'rechaza producto con tenant nulo sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'UPDATE "Producto" SET "tenantId" = NULL;', accepted: false },
  { name: 'rechaza proveedor con tenant nulo sin fuente', tenant: "'tenant-a'", source: 'NULL',
    setup: 'UPDATE "Vendor" SET "tenantId" = NULL;', accepted: false },
];

describe('R5: procedencia del tenant de CompraProducto', () => {
  it.each(cases)('$name', (scenario) => {
    const result = runScenario(scenario);
    expect(result.error).toBeUndefined();
    if (scenario.accepted) {
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe('tenant-a');
    } else {
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('Cannot safely backfill CompraProducto');
    }
  });
});
