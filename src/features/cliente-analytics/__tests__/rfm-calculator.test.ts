/**
 * @description Tests unitarios para el algoritmo RFM.
 *
 * @module features/cliente-analytics/__tests__/rfm-calculator.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calcularSegmentoRFM,
  calcularRFMCompleto,
  scoreRecencia,
  scoreFrecuencia,
  scoreMonetario,
  diasDesdeUltimaCompra,
  cohorteAdquisicion,
  ticketPromedio,
  repeatPurchaseRate,
} from '../services/rfm-calculator';

describe('calcularSegmentoRFM', () => {
  it('clasifica como Champion a cliente con alta recencia, frecuencia y monto', () => {
    expect(calcularSegmentoRFM({ recencia: 10, frecuencia: 10, monetario: 100000 })).toBe('Champion');
  });

  it('clasifica como Loyal a cliente con recencia y frecuencia moderada', () => {
    expect(calcularSegmentoRFM({ recencia: 30, frecuencia: 5, monetario: 20000 })).toBe('Loyal');
  });

  it('clasifica como At Risk a cliente inactivo 90+ días con frecuencia', () => {
    expect(calcularSegmentoRFM({ recencia: 100, frecuencia: 3, monetario: 30000 })).toBe('At Risk');
  });

  it('clasifica como Lost a cliente inactivo 180+ días', () => {
    expect(calcularSegmentoRFM({ recencia: 200, frecuencia: 2, monetario: 10000 })).toBe('Lost');
  });

  it('clasifica como New a cliente con primera compra reciente', () => {
    expect(calcularSegmentoRFM({ recencia: 5, frecuencia: 1, monetario: 5000 })).toBe('New');
  });

  it('clasifica como Regular a cliente que no cumple otros criterios', () => {
    expect(calcularSegmentoRFM({ recencia: 45, frecuencia: 2, monetario: 15000 })).toBe('Regular');
  });
});

describe('calcularRFMCompleto', () => {
  it('calcula scores y segmento correctamente', () => {
    const result = calcularRFMCompleto({ recencia: 10, frecuencia: 10, monetario: 600000 });
    expect(result.recenciaScore).toBe(5);
    expect(result.frecuenciaScore).toBe(5);
    expect(result.monetarioScore).toBe(5);
    expect(result.segmento).toBe('Champion');
    expect(result.scoreLealtad).toBe(100);
  });

  it('calcula scores bajos para cliente perdido', () => {
    const result = calcularRFMCompleto({ recencia: 200, frecuencia: 1, monetario: 5000 });
    expect(result.recenciaScore).toBe(1);
    expect(result.frecuenciaScore).toBe(1);
    expect(result.monetarioScore).toBe(1);
    expect(result.segmento).toBe('Lost');
    expect(result.scoreLealtad).toBeLessThan(50);
  });
});

describe('scoreRecencia', () => {
  it('asigna 5 a recencia <= 14 días', () => {
    expect(scoreRecencia(10)).toBe(5);
  });

  it('asigna 4 a recencia <= 30 días', () => {
    expect(scoreRecencia(20)).toBe(4);
  });

  it('asigna 3 a recencia <= 60 días', () => {
    expect(scoreRecencia(45)).toBe(3);
  });

  it('asigna 2 a recencia <= 90 días', () => {
    expect(scoreRecencia(75)).toBe(2);
  });

  it('asigna 1 a recencia > 90 días', () => {
    expect(scoreRecencia(120)).toBe(1);
  });
});

describe('scoreFrecuencia', () => {
  it('asigna 5 a frecuencia >= 10', () => {
    expect(scoreFrecuencia(15)).toBe(5);
  });

  it('asigna 4 a frecuencia >= 5', () => {
    expect(scoreFrecuencia(7)).toBe(4);
  });

  it('asigna 1 a frecuencia = 1', () => {
    expect(scoreFrecuencia(1)).toBe(1);
  });
});

describe('scoreMonetario', () => {
  it('asigna 5 a monto >= 500000', () => {
    expect(scoreMonetario(600000)).toBe(5);
  });

  it('asigna 1 a monto < 50000', () => {
    expect(scoreMonetario(10000)).toBe(1);
  });
});

describe('diasDesdeUltimaCompra', () => {
  it('calcula días correctamente', () => {
    const ahora = new Date('2026-01-15');
    const ultima = new Date('2026-01-10');
    expect(diasDesdeUltimaCompra(ultima, ahora)).toBe(5);
  });

  it('retorna 9999 cuando no hay última compra', () => {
    expect(diasDesdeUltimaCompra(null)).toBe(9999);
  });
});

describe('cohorteAdquisicion', () => {
  it('calcula cohorte Q1 correctamente', () => {
    expect(cohorteAdquisicion(new Date('2026-02-15'))).toBe('2026-Q1');
  });

  it('calcula cohorte Q2 correctamente', () => {
    expect(cohorteAdquisicion(new Date('2026-05-15'))).toBe('2026-Q2');
  });

  it('calcula cohorte Q4 correctamente', () => {
    expect(cohorteAdquisicion(new Date('2026-11-15'))).toBe('2026-Q4');
  });
});

describe('ticketPromedio', () => {
  it('calcula ticket promedio correctamente', () => {
    expect(ticketPromedio(100000, 5)).toBe(20000);
  });

  it('retorna null cuando no hay compras', () => {
    expect(ticketPromedio(0, 0)).toBeNull();
  });
});

describe('repeatPurchaseRate', () => {
  it('retorna 0 para una sola compra', () => {
    expect(repeatPurchaseRate(1)).toBe(0);
  });

  it('calcula tasa correcta para múltiples compras', () => {
    expect(repeatPurchaseRate(5)).toBeCloseTo(0.8);
  });

  it('retorna 0 para cero compras', () => {
    expect(repeatPurchaseRate(0)).toBe(0);
  });
});
