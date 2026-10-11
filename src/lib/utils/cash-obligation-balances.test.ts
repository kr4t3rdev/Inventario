import { describe, expect, it } from 'vitest';
import {
  calcularSaldoPendientePrestamo,
  normalizarEstadoPrestamoCash,
} from '@/lib/utils/prestamo-cash';
import {
  calcularSaldoPendienteDeuda,
  normalizarEstadoDeudaCash,
} from '@/lib/utils/deuda-cash';

describe('cash obligation balance precision', () => {
  it('preserves a balance to four decimal places', () => {
    expect(calcularSaldoPendientePrestamo('123.4567', '0').toFixed(4)).toBe('123.4567');
  });

  it('does not mark a positive balance below one cent as paid', () => {
    const balance = calcularSaldoPendientePrestamo('100', '99.9877');

    expect(balance.toFixed(4)).toBe('0.0123');
    expect(normalizarEstadoPrestamoCash('ACTIVO', {
      montoDeuda: '100',
      montoPagado: '99.9877',
    })).toBe('ACTIVO');
    expect(normalizarEstadoPrestamoCash('PAGADO', {
      montoDeuda: '100',
      montoPagado: '99.9877',
      estado: 'PAGADA',
    })).toBe('ACTIVO');
  });

  it('preserves four decimal places and an open balance for cash debts', () => {
    expect(calcularSaldoPendienteDeuda('100', '99.9877').toFixed(4)).toBe('0.0123');
    expect(normalizarEstadoDeudaCash('ACTIVO', {
      montoDeuda: '100',
      montoPagado: '99.9877',
    })).toBe('ACTIVO');
    expect(normalizarEstadoDeudaCash('PAGADO', {
      montoDeuda: '100',
      montoPagado: '99.9877',
      estado: 'PAGADA',
    })).toBe('ACTIVO');
  });
});
