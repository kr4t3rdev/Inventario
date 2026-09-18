import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260918000001_repair_cuenta_por_cobrar_tenant/migration.sql';

describe('CuentaPorCobrar tenant migration', () => {
  it('backfills ownership from invoice or service before enforcing tenant scope', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "tenantId" TEXT');
    expect(migration).toContain('FROM "facturas"');
    expect(migration).toContain('FROM "VentaServicios"');
    expect(migration).toContain('ALTER COLUMN "tenantId" SET NOT NULL');
    expect(migration).toContain('CuentaPorCobrar_tenantId_fkey');
  });
});
