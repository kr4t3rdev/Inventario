import { describe, expect, it } from 'vitest';

import { buildOpeningEntryLines } from './initialization-opening-lines';

describe('líneas de apertura de inventario inicial', () => {
  it('debita inventarios y acredita resultados acumulados por el valor funcional', () => {
    const result = buildOpeningEntryLines({
      cuentas: [],
      valued: [],
      monedaFuncional: 'CUP',
      initialInventoryTotalFuncional: '102.0000',
    });

    expect(result.lines).toEqual([
      expect.objectContaining({
        index: 0,
        numeroCuenta: 'INVENTARIO_INICIAL',
        lado: 'DEBE',
        rolCuenta: 'INVENTARIOS',
        moneda: 'CUP',
        montoOriginal: '102',
        montoFuncional: '102',
      }),
      expect.objectContaining({
        index: 0,
        numeroCuenta: 'INVENTARIO_INICIAL',
        lado: 'HABER',
        rolCuenta: 'RESULTADOS_ACUMULADOS',
        moneda: 'CUP',
        montoOriginal: '102',
        montoFuncional: '102',
      }),
    ]);
    expect(result.totalDebeFuncional).toBe('102');
    expect(result.totalHaberFuncional).toBe('102');
  });
});
