import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'scripts/ops/repair-vercel-tenant-schema.sql'),
  'utf8',
);

describe('legacy Vercel tenant schema repair', () => {
  it('guards the legacy backfill to a single tenant', () => {
    expect(sql).toContain('IF tenant_count <> 1 THEN');
    expect(sql).toContain('RAISE EXCEPTION');
  });

  it('preserves existing units and products instead of cloning and deleting units', () => {
    expect(sql).toContain('UPDATE "Unidad"');
    expect(sql).not.toMatch(/DELETE\s+FROM\s+"Unidad"/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"Unidad"/i);
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('is idempotent for columns, indexes, and foreign keys', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "tenantId"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
    expect(sql).toContain('ADD CONSTRAINT "Unidad_tenantId_fkey"');
    expect(sql).toContain('ADD CONSTRAINT "TipoPago_tenantId_fkey"');
  });

  it('fails closed when legacy rows cannot be assigned to the tenant', () => {
    expect(sql).toContain('"Unidad" WHERE "tenantId" IS NULL');
    expect(sql).toContain('"TipoPago" WHERE "tenantId" IS NULL');
    expect(sql).toContain('No se pudo asignar tenantId');
  });
});
