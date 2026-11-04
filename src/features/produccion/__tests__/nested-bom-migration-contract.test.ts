import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20261114000000_nested_recipe_bom/migration.sql'),
  'utf8',
);

describe('contrato de migración para BOM multinivel', () => {
  it('modela la relación opcional a subreceta con identidad tenant-scoped', () => {
    expect(schema).toMatch(/recetaIngredienteId\s+String\?/);
    expect(schema).toMatch(/@@unique\(\[tenantId, recetaId\]/);
    expect(schema).toMatch(/@relation\("SubrecetaBOM", fields: \[tenantId, recetaIngredienteId\]/);
  });

  it('crea la FK compuesta tenant-scoped y restringe borrar una receta referenciada', () => {
    expect(migration).toContain('SET "id" = COALESCE("id", "recetaIngredienteId")');
    expect(migration).toMatch(/DROP COLUMN "recetaIngredienteId"[\s\S]*ADD COLUMN "recetaIngredienteId" TEXT/);
    expect(migration).toContain('"RecetaIngrediente_subreceta_tenant_fkey"');
    expect(migration).toMatch(/FOREIGN KEY \("tenantId", "recetaIngredienteId"\)/);
    expect(migration).toMatch(/ON DELETE RESTRICT/);
    expect(migration).toContain('"RecetaIngrediente_tenantId_recetaIngredienteId_idx"');
  });
});
