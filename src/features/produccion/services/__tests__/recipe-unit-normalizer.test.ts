import { describe, expect, it } from 'vitest';
import { normalizeRecipeIngredientsToStock } from '../recipe-unit-normalizer';

describe('normalizeRecipeIngredientsToStock', () => {
  it('normaliza unidades legacy de masa a la unidad base de stock', () => {
    expect(normalizeRecipeIngredientsToStock([{
      productoId: 'flour',
      cantidad: 500,
      unidadSimbolo: 'g',
      producto: {
        id: 'flour',
        nombre: 'Harina',
        unidadSimbolo: 'kg',
        unidadDimension: 'MASS',
      },
    }])).toEqual([{ productoId: 'flour', cantidad: 0.5, unidadSimbolo: 'kg' }]);
  });

  it('aplica el factor por producto de una presentación a unidad stock', () => {
    expect(normalizeRecipeIngredientsToStock([{
      productoId: 'oil',
      cantidad: 2,
      unidadSimbolo: 'botella',
      producto: {
        id: 'oil',
        nombre: 'Aceite',
        unidadSimbolo: 'ml',
        unidadDimension: 'VOLUME',
        unidadesConversion: [{
          factorAStock: '900',
          unidad: { simbolo: 'botella', dimension: 'VOLUME' },
        }],
      },
    }])).toEqual([{ productoId: 'oil', cantidad: 1800, unidadSimbolo: 'ml' }]);
  });

  it('rechaza símbolos incompatibles en vez de consumir cantidades ambiguas', () => {
    expect(() => normalizeRecipeIngredientsToStock([{
      productoId: 'flour',
      cantidad: 2,
      unidadSimbolo: 'L',
      producto: {
        id: 'flour',
        nombre: 'Harina',
        unidadSimbolo: 'kg',
        unidadDimension: 'MASS',
      },
    }])).toThrow('Unidad inválida para Harina');
  });
});
