import { describe, expect, it } from 'vitest';
import { buildPurchaseUnitPayload } from './unit-selection-payload';

describe('buildPurchaseUnitPayload', () => {
  it('sends alternate units only for direct purchases and keeps the legacy base-unit payload', () => {
    const lines = [
      { productoId: 'p1', cantidad: 2, unidadId: 'box' },
      { productoId: 'p1', cantidad: 1, unidadId: 'each' },
    ];
    const baseUnits = new Map([['p1', 'each']]);

    expect(buildPurchaseUnitPayload(lines, baseUnits, true)).toEqual([
      { productoId: 'p1', cantidad: 2, unidadId: 'box' },
      { productoId: 'p1', cantidad: 1 },
    ]);
    expect(buildPurchaseUnitPayload(lines, baseUnits, false)).toEqual([
      { productoId: 'p1', cantidad: 2 },
      { productoId: 'p1', cantidad: 1 },
    ]);
  });
});
