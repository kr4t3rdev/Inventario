import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20260912000003_transferencia_numero_tenant_parcial/migration.sql',
);

describe('Transferencia tenant migration', () => {
  it('is recoverable after a partially applied production run', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "tenantId" TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "cantidadRecibida" INTEGER');
    expect(sql).toContain('DROP INDEX IF EXISTS "Transferencia_numeroTransferencia_key"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Transferencia_tenantId_numeroTransferencia_key"',
    );
    expect(sql).toContain('FROM pg_constraint');
    expect(sql).toContain("conname = 'Transferencia_tenantId_fkey'");
    expect(sql).toContain('GROUP BY "tenantId", "numeroTransferencia"');
    expect(sql).toContain('WHERE "numeroTransferencia" IS NOT NULL');
    expect(sql).toContain('RAISE EXCEPTION');
  });
});
