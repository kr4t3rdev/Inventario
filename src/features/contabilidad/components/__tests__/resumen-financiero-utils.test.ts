import { describe, expect, it } from 'vitest';

import {
  buildGastosPendientesFilters,
  getSaldoNetoTotal,
} from '../resumen-financiero-utils';
import { endOfDay } from '@/lib/date-range';

describe('resumen financiero utilities', () => {
  it('uses the complete selected period for pending expenses', () => {
    expect(buildGastosPendientesFilters({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      tipoGasto: 'operativo',
      soloNoReconciliados: true,
      page: 1,
      limit: 20,
    })).toEqual({
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      tipoGasto: 'operativo',
      soloNoReconciliados: true,
      page: 1,
      limit: 20,
    });
  });

  it('uses the principal currency flow as the net total', () => {
    expect(getSaldoNetoTotal([
      { moneda: 'USD', flujoNeto: 900 },
      { moneda: 'CUP', flujoNeto: 125 },
    ], 'CUP')).toBe(125);
  });

  it('includes the full selected end date in date filters', () => {
    expect(endOfDay('2026-01-31').toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });

  it('getSaldoNetoTotal retorna 0 cuando la moneda no existe en el resumen', () => {
    expect(getSaldoNetoTotal([
      { moneda: 'CUP', flujoNeto: 500 },
    ], 'USD')).toBe(0);
  });

  it('getSaldoNetoTotal retorna 0 cuando el resumen es undefined', () => {
    expect(getSaldoNetoTotal(undefined, 'CUP')).toBe(0);
  });

  it('getSaldoNetoTotal retorna 0 cuando el resumen es un array vacío', () => {
    expect(getSaldoNetoTotal([], 'CUP')).toBe(0);
  });

  it('getSaldoNetoTotal no mezcla monedas: cada una tiene su propio valor', () => {
    const resumen = [
      { moneda: 'CUP', flujoNeto: 1000 },
      { moneda: 'USD', flujoNeto: 200 },
      { moneda: 'EUR', flujoNeto: -50 },
    ];

    expect(getSaldoNetoTotal(resumen, 'CUP')).toBe(1000);
    expect(getSaldoNetoTotal(resumen, 'USD')).toBe(200);
    expect(getSaldoNetoTotal(resumen, 'EUR')).toBe(-50);
  });

  it('buildGastosPendientesFilters maneja fechas undefined correctamente', () => {
    const result = buildGastosPendientesFilters({
      page: 1,
      limit: 10,
    });

    expect(result.fechaDesde).toBeUndefined();
    expect(result.fechaHasta).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('buildGastosPendientesFilters preserva todos los parámetros', () => {
    const result = buildGastosPendientesFilters({
      fechaInicio: '2026-06-01',
      fechaFin: '2026-06-30',
      tipoGasto: 'GASTODE',
      soloNoReconciliados: false,
      page: 3,
      limit: 25,
    });

    expect(result).toEqual({
      fechaDesde: '2026-06-01',
      fechaHasta: '2026-06-30',
      tipoGasto: 'GASTODE',
      soloNoReconciliados: false,
      page: 3,
      limit: 25,
    });
  });
});
