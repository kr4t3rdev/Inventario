import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('migración de plantillas y variantes de producto', () => {
  it('crea plantillas tenant-scoped y producto variante con atributos/SKU propios', () => {
    const migration = readFileSync(
      resolve(root, 'prisma/migrations/20261113000000_add_product_variants/migration.sql'),
      'utf8',
    );
    const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model ProductoPlantilla {');
    expect(schema).toMatch(/atributoJson\s+Json\?/);
    expect(schema).toMatch(/sku\s+String\?/);
    expect(schema).toMatch(/esVariante\s+Boolean\s+@default\(false\)/);
    expect(migration).toContain('CREATE TABLE "producto_plantillas"');
    expect(migration).toContain('Producto_plantilla_tenant_fkey');
    expect(migration).toContain('Producto_tenant_sku_key');
    expect(migration).toContain('Producto_variant_fields_check');
  });
});
