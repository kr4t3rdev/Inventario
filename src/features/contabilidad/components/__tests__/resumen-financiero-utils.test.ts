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
});
