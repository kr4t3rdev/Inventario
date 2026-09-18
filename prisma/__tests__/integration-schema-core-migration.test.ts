import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260915000000_repair_integration_schema_core/migration.sql';

describe('integration schema core migration', () => {
  it('does not reference the removed RecetaIngrediente legacy id directly', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/information_schema\.columns/);
    expect(sql).toMatch(/column_name\s*=\s*'recetaIngredienteId'/);
    expect(sql).toMatch(/EXECUTE/);
    expect(sql).toMatch(/SET\s+"id"\s*=\s*gen_random_uuid\(\)::TEXT/);
    expect(sql).toMatch(/WHERE\s+"id"\s+IS\s+NULL/);
  });
});
