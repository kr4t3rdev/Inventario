import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/unidad-tenant-scoping.sql'),
  'utf8',
);
const runnerSource = readFileSync(
  resolve(process.cwd(), 'scripts/run-unidad-migration.cjs'),
  'utf8',
);

describe('Railway Unidad tenant migration', () => {
  it('remaps product references before creating tenant-specific unit clones', () => {
    expect(migrationSql).toContain('CREATE TEMP TABLE "_UnidadTenantMap"');
    expect(migrationSql).toContain('UPDATE "Producto"');
    expect(migrationSql).toContain('INSERT INTO "Unidad"');
    expect(migrationSql.indexOf('UPDATE "Producto"')).toBeLessThan(
      migrationSql.indexOf('INSERT INTO "Unidad"'),
    );
  });

  it('never deletes units during the tenant backfill', () => {
    expect(migrationSql).not.toMatch(/DELETE\s+FROM\s+"Unidad"/i);
    expect(migrationSql).toContain('ON DELETE RESTRICT');
  });

  it('does not hide failed transactions behind an already-exists fallback', () => {
    expect(runnerSource).not.toContain("msg.includes('already exists')");
    expect(runnerSource).toContain('throw err');
  });
});
