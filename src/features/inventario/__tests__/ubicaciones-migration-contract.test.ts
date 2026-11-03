import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = resolve(
  root,
  'prisma/migrations/20261111000000_inventory_location_stock_details/migration.sql',
);
const schemaPath = resolve(root, 'prisma/schema.prisma');

describe('migración de saldos por ubicación hija', () => {
  it('conserva StockUbicacion agregado y crea saldos detalle vinculados a hojas', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const schema = readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('model StockUbicacionDetalle {');
    expect(schema).toContain('ubicacionHijaId String');
    expect(migration).toContain('CREATE TABLE "StockUbicacionDetalle"');
  });

  it('agrega columnas ubicacionHija a tablas de inventario', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN "ubicacionHijaId" TEXT');
    expect(migration).toContain('ADD COLUMN "ubicacionHijaKey"');
  });

  it('backfillea saldos y eventos históricos en General sin cambiar el agregado', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('INSERT INTO "StockUbicacionDetalle"');
    expect(migration).toContain("'legacy-general-' || su.\"ubicacionId\"");
    expect(migration).toContain('UPDATE "StockMoveLine"');
    expect(migration).toContain('UPDATE "AjusteInventario"');
    expect(migration).toContain('UPDATE "ConteoInventario"');
    expect(migration).toContain('StockMoveLine_eventoKey_key');
    expect(migration).toContain('does not reconcile');
  });
});
