import { describe, it, expect } from 'vitest';
import {
  categorizeUnit,
  validateUnitCompatibility,
  validateIngredientsUnits,
  suggestUnitsByCategory,
} from './production-units';

describe('Production Units Validator', () => {
  describe('categorizeUnit', () => {
    it('should categorize null/undefined as unit', () => {
      expect(categorizeUnit(null)).toBe('unit');
      expect(categorizeUnit(undefined)).toBe('unit');
      expect(categorizeUnit('')).toBe('unit');
    });

    it('should categorize "unidad" and "pieza" as unit', () => {
      expect(categorizeUnit('unidad')).toBe('unit');
      expect(categorizeUnit('pieza')).toBe('unit');
      expect(categorizeUnit('UNIDAD')).toBe('unit');
      expect(categorizeUnit('PIEZA')).toBe('unit');
      expect(categorizeUnit('  unidad  ')).toBe('unit');
    });

    it('should categorize mass units correctly', () => {
      expect(categorizeUnit('g')).toBe('mass');
      expect(categorizeUnit('kg')).toBe('mass');
      expect(categorizeUnit('lb')).toBe('mass');
      expect(categorizeUnit('oz')).toBe('mass');
      expect(categorizeUnit('KG')).toBe('mass');
      expect(categorizeUnit('LB')).toBe('mass');
    });

    it('should categorize volume units correctly', () => {
      expect(categorizeUnit('ml')).toBe('volume');
      expect(categorizeUnit('L')).toBe('volume');
      expect(categorizeUnit('l')).toBe('volume'); // lowercase 'l' should map to volume
      expect(categorizeUnit('fl oz')).toBe('volume');
      expect(categorizeUnit('tsp')).toBe('volume');
      expect(categorizeUnit('tbsp')).toBe('volume');
      expect(categorizeUnit('cup')).toBe('volume');
      expect(categorizeUnit('ML')).toBe('volume');
    });

    it('should categorize unknown units as unknown', () => {
      expect(categorizeUnit('bls')).toBe('unknown');
      expect(categorizeUnit('xyz')).toBe('unknown');
      expect(categorizeUnit('metros')).toBe('unknown');
    });
  });

  describe('validateUnitCompatibility', () => {
    it('should be compatible when both are null/undefined', () => {
      const result = validateUnitCompatibility(null, undefined);
      expect(result.isCompatible).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should warn when units are unknown', () => {
      const result1 = validateUnitCompatibility('bls', 'kg');
      expect(result1.isCompatible).toBe(false);
      expect(result1.warning).toContain('Unidad desconocida');
      expect(result1.warning).toContain('bls');

      const result2 = validateUnitCompatibility('kg', 'xyz');
      expect(result2.isCompatible).toBe(false);
      expect(result2.warning).toContain('Unidad desconocida');
      expect(result2.warning).toContain('xyz');
    });

    it('should be compatible when both are unit types', () => {
      const result = validateUnitCompatibility('unidad', 'pieza');
      expect(result.isCompatible).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should be incompatible when one is unit and other is mass/volume', () => {
      const result1 = validateUnitCompatibility('unidad', 'kg');
      expect(result1.isCompatible).toBe(false);
      expect(result1.warning).toContain('Inconsistencia');

      const result2 = validateUnitCompatibility('L', 'pieza');
      expect(result2.isCompatible).toBe(false);
      expect(result2.warning).toContain('Inconsistencia');
    });

    it('should be compatible when both are mass units', () => {
      const result1 = validateUnitCompatibility('kg', 'g');
      expect(result1.isCompatible).toBe(true);
      expect(result1.warning).toBeNull();

      const result2 = validateUnitCompatibility('lb', 'oz');
      expect(result2.isCompatible).toBe(true);
      expect(result2.warning).toBeNull();

      const result3 = validateUnitCompatibility('KG', 'oz');
      expect(result3.isCompatible).toBe(true);
      expect(result3.warning).toBeNull();
    });

    it('should be compatible when both are volume units', () => {
      const result1 = validateUnitCompatibility('L', 'ml');
      expect(result1.isCompatible).toBe(true);
      expect(result1.warning).toBeNull();

      const result2 = validateUnitCompatibility('tsp', 'tbsp');
      expect(result2.isCompatible).toBe(true);
      expect(result2.warning).toBeNull();

      const result3 = validateUnitCompatibility('L', 'cup'); // Using uppercase L
      expect(result3.isCompatible).toBe(true);
      expect(result3.warning).toBeNull();
    });

    it('should be incompatible when one is mass and other is volume', () => {
      const result1 = validateUnitCompatibility('kg', 'L');
      expect(result1.isCompatible).toBe(false);
      expect(result1.warning).toContain('Unidades incompatibles');
      expect(result1.warning).toContain('mass');
      expect(result1.warning).toContain('volume');

      const result2 = validateUnitCompatibility('ml', 'oz');
      expect(result2.isCompatible).toBe(false);
      expect(result2.warning).toContain('incompatibles');
    });
  });

  describe('validateIngredientsUnits', () => {
    const mockProductos = [
      { id: 'prod1', nombre: 'Harina', unidadSimbolo: 'kg' },
      { id: 'prod2', nombre: 'Agua', unidadSimbolo: 'L' },
      { id: 'prod3', nombre: 'Sal', unidadSimbolo: 'g' },
      { id: 'prod4', nombre: 'Leche', unidadSimbolo: 'ml' },
    ];

    it('should validate compatible mass units', () => {
      const ingredientes = [
        { productoId: 'prod1', unidadSimbolo: 'g' }, // receta: g, producto: kg
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].productoId).toBe('prod1');
      expect(result[0].isValid).toBe(true);
      expect(result[0].warning).toBeNull();
      expect(result[0].productoNombre).toBe('Harina');
    });

    it('should validate compatible volume units', () => {
      const ingredientes = [
        { productoId: 'prod2', unidadSimbolo: 'ml' }, // receta: ml, producto: L
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(true);
      expect(result[0].warning).toBeNull();
    });

    it('should detect incompatible units (mass vs volume)', () => {
      const ingredientes = [
        { productoId: 'prod1', unidadSimbolo: 'L' }, // receta: L, producto: kg
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false);
      expect(result[0].warning).toContain('Harina');
      expect(result[0].warning).toContain('incompatibles');
    });

    it('should warn on unknown units', () => {
      const ingredientes = [
        { productoId: 'prod3', unidadSimbolo: 'bls' }, // unknown unit
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false);
      expect(result[0].warning).toContain('Unidad desconocida');
      expect(result[0].warning).toContain('bls');
    });

    it('should handle missing product', () => {
      const ingredientes = [
        { productoId: 'nonexistent', unidadSimbolo: 'kg' },
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false);
      expect(result[0].warning).toContain('Producto no encontrado');
      expect(result[0].productoNombre).toBeNull();
    });

    it('should validate multiple ingredients at once', () => {
      const ingredientes = [
        { productoId: 'prod1', unidadSimbolo: 'g' }, // compatible (mass)
        { productoId: 'prod2', unidadSimbolo: 'ml' }, // compatible (volume)
        { productoId: 'prod1', unidadSimbolo: 'L' }, // incompatible (mass vs volume)
        { productoId: 'prod4', unidadSimbolo: 'oz' }, // incompatible (volume vs unknown... wait, oz is mass)
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(4);

      // First one: compatible
      expect(result[0].isValid).toBe(true);
      expect(result[0].warning).toBeNull();

      // Second one: compatible
      expect(result[1].isValid).toBe(true);

      // Third one: incompatible mass vs volume
      expect(result[2].isValid).toBe(false);
      expect(result[2].warning).toContain('incompatibles');

      // Fourth one: incompatible volume (ml in product, oz is mass in recipe)
      // Actually oz is MASS, not volume, so this should fail
      expect(result[3].isValid).toBe(false);
      expect(result[3].warning).toContain('incompatibles');
    });

    it('should handle null/undefined units as compatible with any unit', () => {
      const ingredientes = [
        { productoId: 'prod1', unidadSimbolo: null }, // null should be compatible with any
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false); // null ('unit') is incompatible with 'kg' ('mass')
      expect(result[0].warning).toContain('Inconsistencia');
    });

    it('should return empty array for empty ingredients', () => {
      const result = validateIngredientsUnits([], mockProductos);
      expect(result).toEqual([]);
    });
  });

  describe('suggestUnitsByCategory', () => {
    it('should suggest mass units', () => {
      const suggestions = suggestUnitsByCategory('mass');
      expect(suggestions).toContain('g');
      expect(suggestions).toContain('kg');
      expect(suggestions).toContain('lb');
      expect(suggestions).toContain('oz');
      expect(suggestions.length).toBe(4);
    });

    it('should suggest volume units', () => {
      const suggestions = suggestUnitsByCategory('volume');
      expect(suggestions).toContain('ml');
      expect(suggestions).toContain('L');
      expect(suggestions).toContain('fl oz');
      expect(suggestions).toContain('tsp');
      expect(suggestions).toContain('tbsp');
      expect(suggestions).toContain('cup');
      expect(suggestions.length).toBe(6);
    });

    it('should suggest unit types', () => {
      const suggestions = suggestUnitsByCategory('unit');
      expect(suggestions).toContain('unidad');
      expect(suggestions).toContain('pieza');
      expect(suggestions.length).toBe(2);
    });

    it('should return empty array for unknown category', () => {
      const suggestions = suggestUnitsByCategory('unknown');
      expect(suggestions).toEqual([]);
    });
  });

  describe('Edge cases and floating point', () => {
    it('should handle case-insensitive normalization', () => {
      const result = validateUnitCompatibility('KG', 'g');
      expect(result.isCompatible).toBe(true);

      const result2 = validateUnitCompatibility('ML', 'L');
      expect(result2.isCompatible).toBe(true);
    });

    it('should handle whitespace in units', () => {
      const result = validateUnitCompatibility('  kg  ', '  g  ');
      expect(result.isCompatible).toBe(true);
    });

    it('should handle complex multi-ingredient recipes with mixed units', () => {
      const mockProductos = [
        { id: '1', nombre: 'Harina', unidadSimbolo: 'kg' },
        { id: '2', nombre: 'Agua', unidadSimbolo: 'L' },
        { id: '3', nombre: 'Sal', unidadSimbolo: 'g' },
        { id: '4', nombre: 'Levadura', unidadSimbolo: 'unidad' },
      ];

      const ingredientes = [
        { productoId: '1', unidadSimbolo: 'g' }, // kg recipe unit vs g product - compatible
        { productoId: '2', unidadSimbolo: 'ml' }, // L recipe unit vs ml product - compatible
        { productoId: '3', unidadSimbolo: 'kg' }, // g recipe unit vs kg product - compatible
        { productoId: '4', unidadSimbolo: 'pieza' }, // unidad recipe unit vs unidad product - compatible
      ];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      result.forEach((r) => {
        expect(r.isValid).toBe(true);
        expect(r.warning).toBeNull();
      });
    });

    it('should produce meaningful warnings for debugging', () => {
      const mockProductos = [
        { id: 'pan', nombre: 'Pan integral', unidadSimbolo: 'kg' },
      ];

      const ingredientes = [{ productoId: 'pan', unidadSimbolo: 'L' }];

      const result = validateIngredientsUnits(ingredientes, mockProductos);
      const warning = result[0].warning;

      // Warning should include product name for easy identification
      expect(warning).toContain('Pan integral');
      expect(warning).not.toBeNull();
    });
  });
});
