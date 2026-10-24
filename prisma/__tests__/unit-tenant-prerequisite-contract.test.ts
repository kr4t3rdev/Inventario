import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('unit tenant prerequisite migration contract', () => {
  it('derives ownership only from product references and fails closed on unknown ownership', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20261023000000_scope_units_by_product_tenant/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('JOIN "Producto" p ON p."unidadId" = u."unidadId"');
    expect(migration).toContain('Unreferenced Unidad rows cannot be assigned a tenant safely');
    expect(migration).toContain('Unexpected or malformed foreign-key dependency on Unidad');
    expect(migration).toContain('c.conkey = ARRAY[product_unit]::smallint[]');
    expect(migration).toContain('Unidad index % has an unexpected semantic definition');
    expect(migration).toContain('md5(u."unidadId" || \':\' || p."tenantId")');
    expect(migration).toContain('FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE RESTRICT');
    expect(migration.trimStart()).toMatch(/^(?:--[^\n]*\n)*BEGIN;/);
    expect(migration).toContain("SET LOCAL lock_timeout = '5s';");
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });
});
