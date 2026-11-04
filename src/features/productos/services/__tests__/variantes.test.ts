import { describe, expect, it } from 'vitest';

import { buildVariantCombinations } from '../variantes';

describe('buildVariantCombinations', () => {
  it('genera el producto cartesiano con SKU estable por combinación', () => {
    const result = buildVariantCombinations(
      [
        { nombre: 'Talla', valores: ['S', 'M'] },
        { nombre: 'Color', valores: ['Azul', 'Rojo'] },
      ],
      'CAMISETA',
    );

    expect(result).toEqual([
      { atributos: { Talla: 'S', Color: 'Azul' }, sku: 'CAMISETA-S-AZUL' },
      { atributos: { Talla: 'S', Color: 'Rojo' }, sku: 'CAMISETA-S-ROJO' },
      { atributos: { Talla: 'M', Color: 'Azul' }, sku: 'CAMISETA-M-AZUL' },
      { atributos: { Talla: 'M', Color: 'Rojo' }, sku: 'CAMISETA-M-ROJO' },
    ]);
  });

  it('rechaza dimensiones vacías y valores duplicados tras normalizar espacios', () => {
    expect(() => buildVariantCombinations([{ nombre: 'Talla', valores: [] }], 'SKU'))
      .toThrow('Cada atributo requiere al menos un valor');
    expect(() => buildVariantCombinations(
      [{ nombre: 'Talla', valores: ['M', ' M '] }],
      'SKU',
    )).toThrow('Los valores de cada atributo deben ser únicos');
  });

  it('rechaza nombres de atributos duplicados ignorando mayúsculas', () => {
    expect(() => buildVariantCombinations(
      [
        { nombre: 'Color', valores: ['Azul'] },
        { nombre: ' color ', valores: ['Rojo'] },
      ],
      'SKU',
    )).toThrow('Los nombres de atributos deben ser únicos');
  });

  it('rechaza matrices que exceden el límite antes de generar combinaciones', () => {
    expect(() => buildVariantCombinations(
      [
        { nombre: 'Talla', valores: ['XS', 'S', 'M', 'L', 'XL'] },
        { nombre: 'Color', valores: ['A', 'B', 'C', 'D', 'E'] },
      ],
      'SKU',
      20,
    )).toThrow('La matriz excede el máximo de 20 variantes');
  });

  it('rechaza SKU que colisionan después de normalizar atributos', () => {
    expect(() => buildVariantCombinations(
      [{ nombre: 'Color', valores: ['Azul claro', 'Azul-claro'] }],
      'CAMISETA',
    )).toThrow('La normalización produce SKU duplicados');
  });

  it('rechaza valores que no producen un segmento SKU alfanumérico', () => {
    expect(() => buildVariantCombinations(
      [{ nombre: 'Empaque', valores: ['📦'] }],
      'SKU',
    )).toThrow('Cada valor de atributo debe aportar letras o números al SKU');
  });
});
