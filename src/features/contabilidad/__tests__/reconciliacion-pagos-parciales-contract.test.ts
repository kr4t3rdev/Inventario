import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'src/features/contabilidad/actions-reconciliacion.ts',
  'utf8',
);

describe('listas de reconciliación y cuentas auxiliares', () => {
  it('excluye compras con CxP activa de gastos pendientes', () => {
    expect(source).toContain('cuentaPorPagar:');
    expect(source).toContain("estado: { in: ['PENDIENTE', 'PARCIAL'] }");
  });
});
