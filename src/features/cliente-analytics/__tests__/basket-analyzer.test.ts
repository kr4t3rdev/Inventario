/**
 * @description Tests unitarios para el basket analyzer.
 *
 * @module features/cliente-analytics/__tests__/basket-analyzer.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  analizarCesta,
  sugerirProductos,
  paresSignificativos,
} from '../services/basket-analyzer';
import type { BasketItem } from '../services/basket-analyzer';

describe('analizarCesta', () => {
  it('detecta pares de productos que se compran juntos', () => {
    const items: BasketItem[] = [
      { productoId: 'A', ventaId: 'v1' },
      { productoId: 'B', ventaId: 'v1' },
      { productoId: 'A', ventaId: 'v2' },
      { productoId: 'B', ventaId: 'v2' },
      { productoId: 'C', ventaId: 'v3' },
    ];

    const result = analizarCesta(items, 0.01, 0.1);
    expect(result.totalTransacciones).toBe(3);
    expect(result.totalProductosUnicos).toBe(3);
    expect(result.pares.length).toBeGreaterThan(0);

    const parAB = result.pares.find((p) => p.productoA === 'A' && p.productoB === 'B');
    expect(parAB).toBeDefined();
    expect(parAB!.coocurrencias).toBe(2);
  });

  it('retorna vacío cuando no hay items', () => {
    const result = analizarCesta([]);
    expect(result.pares).toEqual([]);
    expect(result.totalTransacciones).toBe(0);
  });

  it('filtra pares con soporte bajo', () => {
    const items: BasketItem[] = [
      { productoId: 'A', ventaId: 'v1' },
      { productoId: 'B', ventaId: 'v1' },
      { productoId: 'C', ventaId: 'v2' },
      { productoId: 'D', ventaId: 'v2' },
      { productoId: 'E', ventaId: 'v3' },
      { productoId: 'F', ventaId: 'v3' },
    ];

    const result = analizarCesta(items, 0.5, 0.1);
    // Con soporte mínimo 50%, ningún par califica (cada par aparece en 1/3 = 33%)
    expect(result.pares).toHaveLength(0);
  });

  it('calcula levantamiento correctamente', () => {
    const items: BasketItem[] = [
      { productoId: 'A', ventaId: 'v1' },
      { productoId: 'B', ventaId: 'v1' },
      { productoId: 'A', ventaId: 'v2' },
      { productoId: 'B', ventaId: 'v2' },
      { productoId: 'A', ventaId: 'v3' },
      { productoId: 'B', ventaId: 'v3' },
    ];

    const result = analizarCesta(items, 0.01, 0.1);
    const parAB = result.pares.find((p) => p.productoA === 'A' && p.productoB === 'B');
    expect(parAB).toBeDefined();
    // A y B siempre juntos: levantamiento debería ser > 1
    expect(parAB!.levantamiento).toBeGreaterThan(1);
  });
});

describe('sugerirProductos', () => {
  it('sugiere productos relacionados', () => {
    const pares = [
      { productoA: 'A', productoB: 'B', coocurrencias: 10, soporte: 0.3, confianza: 0.8, levantamiento: 2.5 },
      { productoA: 'A', productoB: 'C', coocurrencias: 5, soporte: 0.2, confianza: 0.5, levantamiento: 1.8 },
      { productoA: 'B', productoB: 'C', coocurrencias: 3, soporte: 0.1, confianza: 0.3, levantamiento: 1.2 },
    ];

    const sugerencias = sugerirProductos(pares, 'A', 5);
    expect(sugerencias).toContain('B');
    expect(sugerencias).toContain('C');
    // B tiene mayor levantamiento, debería ir primero
    expect(sugerencias[0]).toBe('B');
  });

  it('respetar límite de sugerencias', () => {
    const pares = [
      { productoA: 'A', productoB: 'B', coocurrencias: 10, soporte: 0.3, confianza: 0.8, levantamiento: 2.5 },
      { productoA: 'A', productoB: 'C', coocurrencias: 5, soporte: 0.2, confianza: 0.5, levantamiento: 1.8 },
      { productoA: 'A', productoB: 'D', coocurrencias: 3, soporte: 0.1, confianza: 0.3, levantamiento: 1.5 },
    ];

    const sugerencias = sugerirProductos(pares, 'A', 2);
    expect(sugerencias).toHaveLength(2);
  });

  it('retorna vacío cuando no hay pares', () => {
    const sugerencias = sugerirProductos([], 'A');
    expect(sugerencias).toEqual([]);
  });
});

describe('paresSignificativos', () => {
  it('filtra solo pares con levantamiento > 1', () => {
    const pares = [
      { productoA: 'A', productoB: 'B', coocurrencias: 10, soporte: 0.3, confianza: 0.8, levantamiento: 2.5 },
      { productoA: 'A', productoB: 'C', coocurrencias: 5, soporte: 0.2, confianza: 0.5, levantamiento: 0.8 },
      { productoA: 'B', productoB: 'C', coocurrencias: 3, soporte: 0.1, confianza: 0.3, levantamiento: 1.2 },
    ];

    const significativos = paresSignificativos(pares);
    expect(significativos).toHaveLength(2);
    expect(significativos.every((p) => p.levantamiento > 1)).toBe(true);
  });
});
