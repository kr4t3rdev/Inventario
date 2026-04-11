import { describe, expect, it } from 'vitest';

import {
  buildRecipeUnitPreview,
  formatUnitNormalizationMessage,
} from '../page';

describe('E2E lógico: Production Unit Validation Integration', () => {
  describe('buildRecipeUnitPreview', () => {
    const productos = [
      {
        id: 'prod-mass',
        nombre: 'Harina',
        unidad: { simbolo: 'kg' },
      },
      {
        id: 'prod-volume',
        nombre: 'Agua',
        unidad: { simbolo: 'ml' },
      },
      {
        id: 'prod-unit',
        nombre: 'Botella',
        unidad: { simbolo: 'unidad' },
      },
      {
        id: 'prod-full-item',
        nombre: 'Sirope',
        unidad: { simbolo: 'paquete' },
      },
    ];

    it('should return normalization info for compatible non-canonical units', () => {
      const preview = buildRecipeUnitPreview(
        [{ productoId: 'prod-mass', cantidad: 500, unidadSimbolo: 'g', desperdicio: 0 }],
        productos
      );

      expect(preview.hasBlockingIssues).toBe(false);
      expect(preview.blockingMessages).toEqual([]);
      expect(preview.normalizationMessages).toEqual([
        'Harina: 500 g se guardará como 0.5 kg.',
      ]);
      expect(preview.rows[0].normalizationMessage).toBe('Harina: 500 g se guardará como 0.5 kg.');
    });

    it('should block missing unit for measurable products', () => {
      const preview = buildRecipeUnitPreview(
        [{ productoId: 'prod-volume', cantidad: 2, unidadSimbolo: null, desperdicio: 0 }],
        productos
      );

      expect(preview.hasBlockingIssues).toBe(true);
      expect(preview.normalizationMessages).toEqual([]);
      expect(preview.blockingMessages).toEqual([
        'Agua: Debés especificar una unidad para este producto.',
      ]);
      expect(preview.rows[0].blockingMessage).toBe('Agua: Debés especificar una unidad para este producto.');
    });

    it('should allow null unit for discrete products', () => {
      const preview = buildRecipeUnitPreview(
        [{ productoId: 'prod-unit', cantidad: 3, unidadSimbolo: null, desperdicio: 0 }],
        productos
      );

      expect(preview.hasBlockingIssues).toBe(false);
      expect(preview.blockingMessages).toEqual([]);
      expect(preview.normalizationMessages).toEqual([
        'Botella: 3 sin unidad se guardará como 3 unidad.',
      ]);
    });

    it('should allow null unit for catalog products consumed as full items', () => {
      const preview = buildRecipeUnitPreview(
        [{ productoId: 'prod-full-item', cantidad: 2, unidadSimbolo: null, desperdicio: 0 }],
        productos
      );

      expect(preview.hasBlockingIssues).toBe(false);
      expect(preview.blockingMessages).toEqual([]);
      expect(preview.normalizationMessages).toEqual([
        'Sirope: 2 sin unidad se guardará como 2 paquete.',
      ]);
    });

    it('should still block unknown user-entered units for full-item products', () => {
      const preview = buildRecipeUnitPreview(
        [{ productoId: 'prod-full-item', cantidad: 2, unidadSimbolo: 'docena', desperdicio: 0 }],
        productos
      );

      expect(preview.hasBlockingIssues).toBe(true);
      expect(preview.blockingMessages).toEqual([
        'Sirope: La unidad ingresada no es reconocida.',
      ]);
    });

    it('should block incompatible categories equally for create and edit flows', () => {
      const createItems = [{ productoId: 'prod-mass', cantidad: 1, unidadSimbolo: 'L', desperdicio: 0 }];
      const editItems = [{ productoId: 'prod-mass', cantidad: 1, unidadSimbolo: 'L', desperdicio: 0 }];

      const createPreview = buildRecipeUnitPreview(createItems, productos);
      const editPreview = buildRecipeUnitPreview(editItems, productos);

      expect(createPreview.hasBlockingIssues).toBe(true);
      expect(editPreview.hasBlockingIssues).toBe(true);
      expect(createPreview.blockingMessages).toEqual(editPreview.blockingMessages);
    });

    it('should keep edit flow blocked until incompatible items are corrected', () => {
      const invalidEditPreview = buildRecipeUnitPreview(
        [{ productoId: 'prod-mass', cantidad: 1, unidadSimbolo: 'L', desperdicio: 0 }],
        productos
      );
      const validEditPreview = buildRecipeUnitPreview(
        [{ productoId: 'prod-mass', cantidad: 250, unidadSimbolo: 'g', desperdicio: 0 }],
        productos
      );

      expect(invalidEditPreview.hasBlockingIssues).toBe(true);
      expect(validEditPreview.hasBlockingIssues).toBe(false);
      expect(validEditPreview.normalizationMessages).toEqual([
        'Harina: 250 g se guardará como 0.25 kg.',
      ]);
    });
  });

  describe('API contract migration', () => {
    it('should use unitNormalizations on success instead of unitWarnings', () => {
      const successResponse = {
        recetaId: 'rec126',
        nombre: 'Test Recipe',
        rendimiento: 1,
        costoUnitario: 100,
        RecetaIngrediente: [],
        unitNormalizations: [
          {
            productoId: 'prod-mass',
            productoNombre: 'Harina',
            providedUnit: 'g',
            canonicalUnit: 'kg',
            originalCantidad: 500,
            normalizedCantidad: 0.5,
          },
        ],
      };

      expect(successResponse).toHaveProperty('unitNormalizations');
      expect(successResponse).not.toHaveProperty('unitWarnings');
      expect(successResponse.unitNormalizations[0].canonicalUnit).toBe('kg');
    });

    it('should use unitErrors on blocking validation failures', () => {
      const errorResponse = {
        error: 'Hay ingredientes con unidades incompatibles o no normalizables.',
        unitErrors: [
          {
            productoId: 'prod-volume',
            productoNombre: 'Agua',
            providedUnit: null,
            canonicalUnit: 'ml',
            reason: 'missing_unit',
          },
        ],
      };

      expect(errorResponse.error).toContain('unidades');
      expect(errorResponse.unitErrors).toHaveLength(1);
      expect(errorResponse.unitErrors[0].reason).toBe('missing_unit');
    });
  });

  describe('message formatting', () => {
    it('should format normalization messages with explicit canonical result', () => {
      expect(
        formatUnitNormalizationMessage({
          productoId: 'prod-mass',
          productoNombre: 'Harina',
          providedUnit: 'g',
          canonicalUnit: 'kg',
          originalCantidad: 500,
          normalizedCantidad: 0.5,
        })
      ).toBe('Harina: 500 g se guardará como 0.5 kg.');
    });
  });
});
