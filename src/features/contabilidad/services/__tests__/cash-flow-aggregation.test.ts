import { describe, expect, it } from 'vitest';

import {
  aggregateCashFlow,
  computePreviousPeriodRange,
  computeFlowTotals,
} from '../cash-flow-aggregation';

const emptyRecords = {
  reconciliacionesVentas: [] as any[],
  reconciliacionesServicios: [] as any[],
  reconciliacionesGastos: [] as any[],
  ajustesBancarios: [] as any[],
  inyeccionesCapital: [] as any[],
  pagosDeuda: [] as any[],
};

const allFlags = { includePrestamosCash: true, includeDeudasCash: true };

describe('aggregateCashFlow', () => {
  it('suma ventas como ingreso por moneda y omite tipos que no afectan flujo', () => {
    const buckets = aggregateCashFlow(
      {
        ...emptyRecords,
        reconciliacionesVentas: [
          { monto: 100, moneda: 'CUP', tipoReconciliacion: 'VENTA' },
          { monto: 50, moneda: 'CUP', tipoReconciliacion: 'VENTA' },
          { monto: 70, moneda: 'USD', tipoReconciliacion: 'VENTA' },
          { monto: 999, moneda: 'CUP', tipoReconciliacion: 'DESCONOCIDO' },
        ],
      },
      allFlags,
    );

    expect(buckets.ingresosVentas.CUP).toBe(150);
    expect(buckets.ingresosVentas.USD).toBe(70);
    expect(buckets.clasificacionNoReconocida).toBe(1);
  });

  it('clasifica préstamos y deudas cash solo cuando el flag lo permite', () => {
    const records = {
      ...emptyRecords,
      reconciliacionesVentas: [
        { monto: 10, moneda: 'CUP', tipoReconciliacion: 'PRESTAMO_CASH' },
        { monto: 20, moneda: 'CUP', tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO' },
        { monto: 30, moneda: 'CUP', tipoReconciliacion: 'DEUDA_CASH' },
        { monto: 40, moneda: 'CUP', tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' },
      ],
    };

    const conFlags = aggregateCashFlow(records, allFlags);
    expect(conFlags.ingresosPrestamosCash.CUP).toBe(10);
    expect(conFlags.egresosPrestamosCash.CUP).toBe(20);
    expect(conFlags.egresosDeudasCash.CUP).toBe(30);
    expect(conFlags.ingresosDeudasCash.CUP).toBe(40);

    const sinFlags = aggregateCashFlow(records, {
      includePrestamosCash: false,
      includeDeudasCash: false,
    });
    expect(sinFlags.ingresosPrestamosCash.CUP).toBeUndefined();
    expect(sinFlags.egresosPrestamosCash.CUP).toBeUndefined();
    expect(sinFlags.egresosDeudasCash.CUP).toBeUndefined();
    expect(sinFlags.ingresosDeudasCash.CUP).toBeUndefined();
  });

  it('excluye gastos anulados y cuenta los no reconocidos', () => {
    const buckets = aggregateCashFlow(
      {
        ...emptyRecords,
        reconciliacionesGastos: [
          { monto: 80, moneda: 'CUP', tipoGasto: 'GASTODE', estado: 'PAGADA' },
          { monto: 60, moneda: 'CUP', tipoGasto: 'GASTODE', estado: 'ANULADA' },
          { monto: 5, moneda: 'USD', tipoGasto: 'RARO', estado: 'PAGADA' },
        ],
      },
      allFlags,
    );

    expect(buckets.egresosGastos.CUP).toBe(80);
    expect(buckets.egresosGastos.USD).toBeUndefined();
    expect(buckets.clasificacionNoReconocida).toBe(1);
  });

  it('agrega servicios, ajustes, inyecciones y pagos de deuda por moneda', () => {
    const buckets = aggregateCashFlow(
      {
        ...emptyRecords,
        reconciliacionesServicios: [{ monto: 200, moneda: 'USD' }],
        ajustesBancarios: [
          { monto: 30, moneda: 'CUP', tipo: 'ingreso' },
          { monto: 12, moneda: 'CUP', tipo: 'egreso' },
        ],
        inyeccionesCapital: [{ montoRecibido: 500, moneda: 'CUP' }],
        pagosDeuda: [{ montoPagado: 45, cuentaBancaria: { moneda: 'CUP' } }],
      },
      allFlags,
    );

    expect(buckets.ingresosServicios.USD).toBe(200);
    expect(buckets.ingresosAjustes.CUP).toBe(30);
    expect(buckets.egresosAjustes.CUP).toBe(12);
    expect(buckets.ingresosInyecciones.CUP).toBe(500);
    expect(buckets.egresosPagosDeuda.CUP).toBe(45);
  });

  it('usa CUP como moneda por defecto cuando falta', () => {
    const buckets = aggregateCashFlow(
      {
        ...emptyRecords,
        reconciliacionesServicios: [{ monto: 25, moneda: null }],
      },
      allFlags,
    );
    expect(buckets.ingresosServicios.CUP).toBe(25);
  });
});

describe('computeFlowTotals', () => {
  it('combina buckets en totales por moneda', () => {
    const buckets = aggregateCashFlow(
      {
        ...emptyRecords,
        reconciliacionesVentas: [{ monto: 100, moneda: 'CUP', tipoReconciliacion: 'VENTA' }],
        reconciliacionesGastos: [
          { monto: 40, moneda: 'CUP', tipoGasto: 'GASTODE', estado: 'PAGADA' },
        ],
        ajustesBancarios: [{ monto: 10, moneda: 'USD', tipo: 'ingreso' }],
      },
      allFlags,
    );

    const totals = computeFlowTotals(buckets);
    expect(totals.CUP).toEqual({ totalIngresos: 100, totalEgresos: 40, saldoNeto: 60 });
    expect(totals.USD).toEqual({ totalIngresos: 10, totalEgresos: 0, saldoNeto: 10 });
  });
});

describe('computePreviousPeriodRange', () => {
  it('devuelve la ventana previa de igual duración', () => {
    expect(computePreviousPeriodRange('2026-08-01', '2026-08-31')).toEqual({
      fechaInicio: '2026-07-01',
      fechaFin: '2026-07-31',
    });
  });

  it('maneja ventanas de un día', () => {
    expect(computePreviousPeriodRange('2026-03-05', '2026-03-05')).toEqual({
      fechaInicio: '2026-03-04',
      fechaFin: '2026-03-04',
    });
  });

  it('cruza cambio de año correctamente', () => {
    expect(computePreviousPeriodRange('2026-01-01', '2026-01-07')).toEqual({
      fechaInicio: '2025-12-25',
      fechaFin: '2025-12-31',
    });
  });
});
