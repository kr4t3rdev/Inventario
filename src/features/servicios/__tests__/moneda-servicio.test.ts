/**
 * @description Tests de helpers de moneda del módulo servicios (fase MM-3).
 */
import { describe, expect, it } from 'vitest';
import { resolverMonedaServicio, formatearTotalVenta } from '../lib/moneda-servicio';

describe('resolverMonedaServicio', () => {
  const servicios = [
    { servicioId: 's1', moneda: 'USD' },
    { servicioId: 's2', moneda: 'CUP' },
  ];

  it('devuelve la moneda del servicio seleccionado', () => {
    expect(resolverMonedaServicio(servicios, 's1')).toBe('USD');
    expect(resolverMonedaServicio(servicios, 's2')).toBe('CUP');
  });

  it('devuelve CUP si el servicio no existe o no hay selección', () => {
    expect(resolverMonedaServicio(servicios, '')).toBe('CUP');
    expect(resolverMonedaServicio(servicios, 'inexistente')).toBe('CUP');
    expect(resolverMonedaServicio([], 's1')).toBe('CUP');
  });
});

describe('formatearTotalVenta', () => {
  it('formatea con la moneda informada', () => {
    expect(formatearTotalVenta(1000, 'USD')).toContain('US');
  });

  it('usa CUP como respaldo si la fila no tiene moneda (registros legacy)', () => {
    expect(formatearTotalVenta(1000, undefined)).toContain('CUP');
  });
});
