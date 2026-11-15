/**
 * @description Tests unitarios para el calculador de CLV.
 *
 * @module features/cliente-analytics/__tests__/clv-calculator.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calcularCLV,
  calcularTasaDecaimiento,
  calcularCLVVidaTotal,
  frecuenciaAnual,
  clvSimplificado,
} from '../services/clv-calculator';

describe('calcularCLV', () => {
  it('calcula CLV correctamente para cliente frecuente', () => {
    const result = calcularCLV({
      ticketPromedio: 50000,
      frecuenciaAnual: 10,
      margenBruto: 0.25,
      vidaEsperadaAnios: 3,
      totalGastado: 500000,
      totalCompras: 10,
      diasDesdePrimeraCompra: 730, // 2 años para que no sea primer año
    });

    expect(result.clvHistorico).toBe(125000); // 500000 * 0.25
    expect(result.clvProyectado).toBe(125000); // 50000 * 10 * 0.25
    expect(result.clvVidaTotal).toBeGreaterThan(0);
    expect(result.tasaDecaimiento).toBe(0.85); // frecuencia >= 10, más de 1 año
  });

  it('calcula CLV para cliente con baja frecuencia', () => {
    const result = calcularCLV({
      ticketPromedio: 20000,
      frecuenciaAnual: 1,
      margenBruto: 0.2,
      vidaEsperadaAnios: 2,
      totalGastado: 20000,
      totalCompras: 1,
      diasDesdePrimeraCompra: 180,
    });

    expect(result.clvHistorico).toBe(4000);
    expect(result.clvProyectado).toBe(4000);
  });
});

describe('calcularTasaDecaimiento', () => {
  it('retorna 0.9 para primer año', () => {
    expect(calcularTasaDecaimiento(5, 180)).toBe(0.9);
  });

  it('retorna 0.85 para frecuencia >= 10', () => {
    expect(calcularTasaDecaimiento(10, 730)).toBe(0.85);
  });

  it('retorna 0.8 para frecuencia >= 5', () => {
    expect(calcularTasaDecaimiento(5, 730)).toBe(0.8);
  });

  it('retorna 0.6 para frecuencia baja', () => {
    expect(calcularTasaDecaimiento(1, 730)).toBe(0.6);
  });
});

describe('calcularCLVVidaTotal', () => {
  it('calcula serie geométrica correctamente', () => {
    const result = calcularCLVVidaTotal(10000, 3, 0.8);
    expect(result).toBeGreaterThan(0);
    // 10000 * (1 - 0.8^3) / (1 - 0.8) = 10000 * 0.488 / 0.2 = 24400
    expect(result).toBeCloseTo(24400, 0);
  });

  it('maneja tasa de decaimiento >= 1', () => {
    const result = calcularCLVVidaTotal(10000, 3, 1.0);
    expect(result).toBe(30000);
  });

  it('limita a 20 años máximo', () => {
    const result = calcularCLVVidaTotal(10000, 50, 0.8);
    const result20 = calcularCLVVidaTotal(10000, 20, 0.8);
    expect(result).toBe(result20);
  });
});

describe('frecuenciaAnual', () => {
  it('calcula frecuencia anual correctamente', () => {
    expect(frecuenciaAnual(10, 365)).toBe(10);
  });

  it('calcula frecuencia para medio año', () => {
    expect(frecuenciaAnual(5, 182.5)).toBeCloseTo(10);
  });

  it('retorna 0 para días <= 0', () => {
    expect(frecuenciaAnual(5, 0)).toBe(0);
  });
});

describe('clvSimplificado', () => {
  it('calcula CLV simplificado correctamente', () => {
    const result = clvSimplificado(50000, 10, 0.25, 3);
    expect(result).toBe(375000); // 50000 * 10 * 0.25 * 3
  });
});
