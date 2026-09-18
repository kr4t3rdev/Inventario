import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260914240000_add_devoluciones_nota_credito/migration.sql';

describe('DNC migration', () => {
  it('bootstraps ContextoAnticipo before adding the nota de crédito value', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('pg_type');
    expect(migration).toContain('CREATE TYPE "ContextoAnticipo"');
    expect(migration).toContain("'NOTA_CREDITO'");
    expect(migration).toContain('ADD VALUE IF NOT EXISTS');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "Anticipo"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "AnticipoMovimiento"');
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "Anticipo_contratoId_fkey"');
  });
});
