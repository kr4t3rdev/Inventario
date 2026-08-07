import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260801090000_add_explicit_cxc_anulada_state',
  'migration.sql',
);

describe('CuentaPorCobrar explicit annulment migration', () => {
  it('adds ANULADA without rewriting historical amounts or payment rows', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain(
      'ALTER TYPE "EstadoCuentaPorCobrar" ADD VALUE IF NOT EXISTS \'ANULADA\'',
    );
    expect(migration).not.toMatch(/UPDATE\s+"CuentaPorCobrar"/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"ReconciliacionVenta"/i);
  });
});
