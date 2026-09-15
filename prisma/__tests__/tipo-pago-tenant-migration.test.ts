import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations');
const tenantMigrationPath = join(
  migrationsDirectory,
  '20260722120000_add_tenant_id_tipo_pago',
  'migration.sql',
);
const unsafeNotNullMigrationPath = join(
  migrationsDirectory,
  '20260722130000_make_tenant_id_required_tipo_pago',
  'migration.sql',
);

/**
 * @description Comprueba si una ruta existe.
 * @param {string} path - Ruta que se desea comprobar.
 * @returns {Promise<boolean>} `true` cuando la ruta existe.
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('TipoPago tenant migration', () => {
  it('backfills and validates tenantId before enforcing NOT NULL', async () => {
    const migration = await readFile(tenantMigrationPath, 'utf8');
    const addColumnIndex = migration.indexOf('ADD COLUMN "tenantId" TEXT');
    const backfillIndex = migration.indexOf('UPDATE "TipoPago"');
    const validationIndex = migration.indexOf('RAISE EXCEPTION', backfillIndex);
    const notNullIndex = migration.indexOf(
      'ALTER COLUMN "tenantId" SET NOT NULL',
      validationIndex,
    );

    expect(addColumnIndex).toBeGreaterThanOrEqual(0);
    expect(backfillIndex).toBeGreaterThan(addColumnIndex);
    expect(validationIndex).toBeGreaterThan(backfillIndex);
    expect(notNullIndex).toBeGreaterThan(validationIndex);
  });

  it('does not leave a separate NOT NULL migration that deploy can run without backfill', async () => {
    expect(await pathExists(unsafeNotNullMigrationPath)).toBe(false);
  });

  it('runs atomically and preserves the original default account for the owning tenant', async () => {
    const migration = await readFile(tenantMigrationPath, 'utf8');
    const normalizedMigration = migration.trim();

    expect(normalizedMigration.startsWith('BEGIN;')).toBe(true);
    expect(normalizedMigration.endsWith('COMMIT;')).toBe(true);
    expect(migration).toContain('tp."cuentaDefecto" AS "sourceCuentaDefecto"');
    expect(migration).toContain(
      'account."cuentaId" = mapping."sourceCuentaDefecto"',
    );
    expect(migration).not.toContain(
      'account."cuentaId" = source."cuentaDefecto"',
    );
  });
});
