import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260918000000_repair_serie_facturacion_tenant/migration.sql';

describe('SerieFacturacion tenant migration', () => {
  it('backfills tenant ownership before enforcing the scoped contract', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "tenantId" TEXT');
    expect(migration).toContain('UPDATE "series_facturacion"');
    expect(migration).toContain('FROM "facturas"');
    expect(migration).toContain('ALTER COLUMN "tenantId" SET NOT NULL');
    expect(migration).toContain('series_facturacion_tenantId_prefijo_key');
    expect(migration).toContain('SerieFacturacion_tenantId_fkey');
  });
});
