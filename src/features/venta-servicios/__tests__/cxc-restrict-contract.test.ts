/**
 * @description Contrato estático (C-5): la FK CuentaPorCobrar.ventaServicioId
 * debe ser ON DELETE RESTRICT para que ninguna vía de borrado deje CxC huérfanas.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('contrato estático de la FK CxC ↔ VentaServicios (C-5)', () => {
  it('declara onDelete: Restrict en la relación ventaServicio de CuentaPorCobrar', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const inicio = schema.indexOf('model CuentaPorCobrar');
    const fin = schema.indexOf('\nmodel ', inicio + 10);
    const bloque = schema.slice(inicio, fin);

    expect(bloque).toMatch(
      /ventaServicio\s+VentaServicios\?\s+@relation\([^)]*onDelete: Restrict[^)]*\)/,
    );
  });
});
