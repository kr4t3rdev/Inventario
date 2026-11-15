/**
 * @description Tests unitarios para las reglas puras de cálculo de puntos.
 */
import { describe, it, expect } from 'vitest';
import {
  calcularPuntosPorCompra,
  calcularValorCanje,
  verificarCanje,
} from '@/features/lealtad/services/puntos-calculo';

describe('calcularPuntosPorCompra', () => {
  it('calcula puntos básicos según ratio', () => {
    const resultado = calcularPuntosPorCompra({
      totalCompra: 10000,
      puntosPorPeso: 1,
      reglas: null,
    });
    expect(resultado).toBe(10000);
  });

  it('aplica ratio fraccionario', () => {
    const resultado = calcularPuntosPorCompra({
      totalCompra: 5000,
      puntosPorPeso: 0.5,
      reglas: null,
    });
    expect(resultado).toBe(2500);
  });

  it('aplica multiplicador de categoría', () => {
    const resultado = calcularPuntosPorCompra({
      totalCompra: 1000,
      puntosPorPeso: 1,
      reglas: { categorias: { cat1: { multiplicador: 2 } } },
      categoriaId: 'cat1',
    });
    expect(resultado).toBe(2000);
  });

  it('no aplica multiplicador si la categoría no coincide', () => {
    const resultado = calcularPuntosPorCompra({
      totalCompra: 1000,
      puntosPorPeso: 1,
      reglas: { categorias: { cat1: { multiplicador: 2 } } },
      categoriaId: 'cat2',
    });
    expect(resultado).toBe(1000);
  });

  it('retorna 0 si el total es 0', () => {
    const resultado = calcularPuntosPorCompra({
      totalCompra: 0,
      puntosPorPeso: 1,
      reglas: null,
    });
    expect(resultado).toBe(0);
  });
});

describe('calcularValorCanje', () => {
  it('calcula el valor de un canje simple', () => {
    const resultado = calcularValorCanje({
      puntos: 1000,
      puntosMinimos: 1000,
      valorCanje: 100,
    });
    expect(resultado).toBe(100);
  });

  it('calcula múltiples bloques', () => {
    const resultado = calcularValorCanje({
      puntos: 3000,
      puntosMinimos: 1000,
      valorCanje: 100,
    });
    expect(resultado).toBe(300);
  });

  it('descarta el residuo', () => {
    const resultado = calcularValorCanje({
      puntos: 1500,
      puntosMinimos: 1000,
      valorCanje: 100,
    });
    expect(resultado).toBe(100);
  });
});

describe('verificarCanje', () => {
  it('aprueba cuando hay saldo suficiente', () => {
    const resultado = verificarCanje({
      saldoActual: 2000,
      puntosSolicitados: 1000,
      puntosMinimos: 1000,
    });
    expect(resultado.aprobado).toBe(true);
  });

  it('rechaza si los puntos son menores al mínimo', () => {
    const resultado = verificarCanje({
      saldoActual: 2000,
      puntosSolicitados: 500,
      puntosMinimos: 1000,
    });
    expect(resultado.aprobado).toBe(false);
    expect(resultado.motivo).toContain('al menos');
  });

  it('rechaza si el saldo es insuficiente', () => {
    const resultado = verificarCanje({
      saldoActual: 500,
      puntosSolicitados: 1000,
      puntosMinimos: 1000,
    });
    expect(resultado.aprobado).toBe(false);
    expect(resultado.motivo).toContain('insuficiente');
  });
});
