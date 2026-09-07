import { describe, expect, it } from 'vitest';
import { ingresosServiciosFuncional, sumarServiciosPorMoneda } from '../venta-servicios-moneda';

describe('sumarServiciosPorMoneda', () => {
  it('separa los ingresos por moneda sin mezclarlas', () => {
    const result = sumarServiciosPorMoneda([
      { total: 1000, moneda: 'CUP' },
      { total: 50, moneda: 'USD' },
      { total: 500, moneda: 'CUP' },
      { total: 30, moneda: 'mlc' },
      { total: 0, moneda: 'USD' },
    ]);

    expect(result).toEqual({ CUP: 1500, USD: 50, MLC: 30 });
  });

  it('asume moneda funcional para servicios sin moneda', () => {
    const result = sumarServiciosPorMoneda([{ total: 200, moneda: null }], 'CUP');
    expect(result).toEqual({ CUP: 200 });
  });

  it('devuelve objeto vacío si no hay servicios', () => {
    expect(sumarServiciosPorMoneda([])).toEqual({});
  });
});

describe('ingresosServiciosFuncional', () => {
  it('suma solo los servicios en la moneda funcional, excluyendo USD/MLC', () => {
    const servicios = [
      { total: 1000, moneda: 'CUP' },
      { total: 50, moneda: 'USD' },
      { total: 500, moneda: 'CUP' },
      { total: 30, moneda: 'MLC' },
    ];

    expect(ingresosServiciosFuncional(servicios)).toBe(1500);
  });

  it('devuelve 0 cuando todo está en otra moneda', () => {
    expect(ingresosServiciosFuncional([{ total: 50, moneda: 'USD' }])).toBe(0);
  });

  it('respeta otra moneda funcional del tenant si se indica', () => {
    const servicios = [
      { total: 25, moneda: 'USD' },
      { total: 75, moneda: 'usd' },
    ];

    expect(ingresosServiciosFuncional(servicios, 'USD')).toBe(100);
  });
});