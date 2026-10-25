import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationPath =
  'prisma/migrations/20261024110000_purchase_unit_trace/migration.sql';

describe('purchase source-unit trace migration contract', () => {
  it('adds nullable typed source and stock-unit snapshots to purchase document items', () => {
    const item = schema.match(/model CompraDocumentoItem \{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const field of [
      'unidadOrigenId',
      'unidadOrigenNombre',
      'unidadOrigenSimbolo',
      'cantidadOrigen',
      'precioUnitarioOrigen',
      'factorAStockAplicado',
      'unidadBaseIdSnapshot',
      'unidadBaseNombreSnapshot',
      'unidadBaseSimboloSnapshot',
    ]) {
      expect(item).toMatch(new RegExp(`\\b${field}\\s+`));
      expect(item).toMatch(new RegExp(`\\b${field}\\s+\\w+\\?`));
    }
    expect(item).toMatch(/factorAStockAplicado\s+Decimal\?\s+@db\.Decimal\(18, 8\)/);
  });

  it('uses an atomic bounded additive migration with all-or-none and exact arithmetic checks', () => {
    const sql = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');
    expect(sql.trimStart()).toMatch(/^BEGIN;/);
    expect(sql).toContain("SET LOCAL lock_timeout = '5s'");
    expect(sql).toContain('ADD COLUMN "unidadOrigenId" TEXT');
    expect(sql).toContain('ADD COLUMN "factorAStockAplicado" DECIMAL(18, 8)');
    expect(sql).toMatch(/CHECK \(\s*\(/);
    expect(sql).toContain('"factorAStockAplicado" <> \'NaN\'::numeric');
    expect(sql).toContain('"factorAStockAplicado" > 0');
    expect(sql).toContain('"cantidadOrigen" > 0');
    expect(sql).toContain('"precioUnitarioOrigen" >= 0');
    expect(sql).toContain('"unidadOrigenId" <> "unidadBaseIdSnapshot" OR "factorAStockAplicado" = 1');
    expect(sql).toContain('"cantidad"::numeric = "cantidadOrigen"::numeric * "factorAStockAplicado"');
    expect(sql).toContain('"precioUnitario"::numeric * "factorAStockAplicado" = "precioUnitarioOrigen"::numeric');
    expect(sql).toContain('"totalLinea"::numeric = "cantidadOrigen"::numeric * "precioUnitarioOrigen"::numeric');
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE FROM|TRUNCATE)\b/i);
  });
});
