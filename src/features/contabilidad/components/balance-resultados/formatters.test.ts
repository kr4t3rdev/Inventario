import { describe, expect, it } from 'vitest';

import { isEmptyFinancialReport } from './formatters';
import type { FinancialData } from './types';

const emptyReport: FinancialData = {
  balance: {
    activos: { efectivo: 0, inventario: 0, cuentasPorCobrar: 0, total: 0 },
    pasivos: { deudaExterna: 0, total: 0 },
    patrimonio: { capitalSocial: 0, utilidadEjercicio: 0, total: 0 },
  },
  estadoResultados: {
    mensual: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      totalIngresos: 0,
      ventasCosto: 0,
      gastosCompras: 0,
      gastosSalarios: 0,
      gastosGenerales: 0,
      gastosMermas: 0,
      totalGastos: 0,
      utilidadNeta: 0,
    })),
    anual: {
      totalIngresos: 0,
      gastosCompras: 0,
      gastosSalarios: 0,
      gastosGenerales: 0,
      gastosMermas: 0,
      totalGastos: 0,
      utilidadNeta: 0,
    },
  },
  reporte: {
    origen: 'LIVE',
    provisional: true,
    fechaCorte: '2026-11-26T12:00:00.000Z',
    resultadoHasta: null,
    periodoId: null,
    integridad: null,
    snapshotVersion: null,
  },
};

describe('isEmptyFinancialReport', () => {
  it('trata doce meses sin importes como un reporte sin actividad', () => {
    expect(isEmptyFinancialReport(emptyReport)).toBe(true);
  });

  it('conserva el reporte cuando un mes contiene importes aunque el total anual sea cero', () => {
    const report = {
      ...emptyReport,
      estadoResultados: {
        ...emptyReport.estadoResultados,
        mensual: emptyReport.estadoResultados.mensual.map((period, index) => (
          index === 0 ? { ...period, totalIngresos: 100 } : period
        )),
      },
    };

    expect(isEmptyFinancialReport(report)).toBe(false);
  });
});
