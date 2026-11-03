import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'prisma',
  'migrations',
  '20261109000000_pago_cuenta_por_pagar_tenant',
  'migration.sql',
);

describe('PagoCuentaPorPagar tenant migration', () => {
  it('backfills tenant ownership from the payable before requiring tenantId', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const addColumnIndex = migration.indexOf('ADD COLUMN IF NOT EXISTS "tenantId" TEXT');
    const backfillIndex = migration.indexOf('UPDATE "PagoCuentaPorPagar"');
    const validationIndex = migration.indexOf('PagoCuentaPorPagar: tenantId backfill is incomplete');
    const notNullIndex = migration.indexOf(
      'ALTER COLUMN "tenantId" SET NOT NULL',
      validationIndex,
    );

    expect(migration.trim().startsWith('BEGIN;')).toBe(true);
    expect(migration.trim().endsWith('COMMIT;')).toBe(true);
    expect(addColumnIndex).toBeGreaterThanOrEqual(0);
    expect(backfillIndex).toBeGreaterThan(addColumnIndex);
    expect(migration).toContain('JOIN "CuentaPorPagar"');
    expect(migration).toContain(
      'payment."tenantId" IS DISTINCT FROM payable."tenantId"',
    );
    expect(validationIndex).toBeGreaterThan(backfillIndex);
    expect(notNullIndex).toBeGreaterThan(validationIndex);
  });

  it('adds tenant integrity and lookup index after the safe backfill', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('"PagoCuentaPorPagar_tenantId_fkey"');
    expect(migration).toContain('REFERENCES "tenants"("tenantId")');
    expect(migration).toContain('"PagoCuentaPorPagar_tenantId_idx"');
  });
});
