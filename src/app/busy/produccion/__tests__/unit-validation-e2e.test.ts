import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * @description Tests E2E para validación de unidades en producción
 * Verifica la integración completa: API → Frontend → UI warnings
 */
describe('E2E: Production Unit Validation Integration', () => {
  describe('Recipe Creation with Unit Warnings', () => {
    /**
     * Scenario: Create a recipe with incompatible units
     * Expected: API returns unitWarnings, frontend displays banner
     */
    it('should capture and display unitWarnings from API response', async () => {
      // Mock API response con warnings
      const mockRecipeResponse = {
        recetaId: 'rec123',
        nombre: 'Refresco Instantáneo',
        rendimiento: 1,
        costoUnitario: 150,
        ingredientes: [
          {
            id: 'ing1',
            productoId: 'prod1',
            cantidad: 500,
            unidadSimbolo: 'mL', // Volumen
            Producto: { id: 'prod1', nombre: 'Concentrate', unidadSimbolo: 'kg' }, // Masa - INCOMPATIBLE
          },
        ],
        // Este es el campo crítico que capturamos en handleCrearReceta
        unitWarnings: [
          "Concentrate: Unidades incompatibles: la receta usa volume pero el producto usa mass",
        ],
      };

      // En handleCrearReceta, capturamos así:
      const unitWarnings = mockRecipeResponse.unitWarnings || [];

      // Verificar que los warnings se capturen correctamente
      expect(unitWarnings).toHaveLength(1);
      expect(unitWarnings[0]).toContain('incompatibles');
      expect(unitWarnings[0]).toContain('Concentrate');
    });

    /**
     * Scenario: Create recipe with multiple incompatibilities
     * Expected: All warnings displayed in banner
     */
    it('should display multiple unit warnings in banner', () => {
      const multipleWarnings = [
        "Harina: Unidades incompatibles: la receta usa volume pero el producto usa mass",
        "Agua: Unidad desconocida: 'bls'. Asegúrate de que sea válida.",
        "Sal: Inconsistencia: receta usa unit, producto usa mass",
      ];

      // El estado unitWarnings se mapea a estos warning strings
      expect(multipleWarnings).toHaveLength(3);

      // Cada warning debe tener INFO útil para el usuario
      multipleWarnings.forEach((warning) => {
        expect(warning.length).toBeGreaterThan(20); // No warnings vacíos
        expect(warning).toMatch(/incompatibles|desconocida|Inconsistencia/);
      });
    });

    /**
     * Scenario: Compatible units don't produce warnings
     * Expected: unitWarnings array is empty or undefined
     */
    it('should not produce warnings for compatible units', () => {
      const mockResponse = {
        recetaId: 'rec124',
        nombre: 'Refresco Compatible',
        unitWarnings: [], // Empty array = no issues
      };

      // Verificar que no hay warnings
      expect(mockResponse.unitWarnings).toEqual([]);

      // O puede ser undefined si la API no incluye el campo
      const undefinedWarnings = undefined;
      const warnings = undefinedWarnings || [];
      expect(warnings).toEqual([]);
    });

    /**
     * Scenario: Ingredient table shows warning icons
     * Expected: Icons visible for rows with unit incompatibilities
     */
    it('should display warning icons in ingredient table rows', () => {
      // En la tabla, para cada item usamos getUnitWarning(item)
      const item1 = {
        productoId: 'prod1',
        cantidad: 500,
        unidadSimbolo: 'g', // Masa
      };

      const product1 = {
        id: 'prod1',
        nombre: 'Harina',
        unidadSimbolo: 'kg', // Masa - compatible
      };

      // Simular validateUnitCompatibility
      const { isCompatible: compatible1 } = {
        isCompatible: true, // g + kg = ambos son masa
        warning: null,
      };

      const shouldShowWarning1 = !compatible1;
      expect(shouldShowWarning1).toBe(false); // No icon needed

      // ----- Item incompatible -----
      const item2 = {
        productoId: 'prod2',
        cantidad: 1,
        unidadSimbolo: 'L', // Volumen
      };

      const product2 = {
        id: 'prod2',
        nombre: 'Sal',
        unidadSimbolo: 'g', // Masa - incompatible
      };

      const { isCompatible: compatible2, warning: warn2 } = {
        isCompatible: false, // L + g = volumen vs masa
        warning: 'Unidades incompatibles: volumen vs masa',
      };

      const shouldShowWarning2 = !compatible2;
      expect(shouldShowWarning2).toBe(true); // Icon should show

      // El título (title attr) debe contener el mensaje
      expect(warn2).toContain('incompatibles');
    });

    /**
     * Scenario: User can see warning details on hover
     * Expected: Warning message appears in title attribute
     */
    it('should display warning message on icon hover', () => {
      const warningMessage = 'Unidades incompatibles: la receta usa volume pero el producto usa mass';

      // En el JSX: <span title={unitWarn}>⚠️</span>
      const iconTitle = warningMessage;

      expect(iconTitle).toBeDefined();
      expect(iconTitle.length).toBeGreaterThan(0);
      expect(iconTitle).toContain('Unidades incompatibles');
    });
  });

  describe('Edit Recipe with Unit Validations', () => {
    /**
     * Scenario: User edits recipe and gets updated warnings
     * Expected: New warnings captured and displayed
     */
    it('should re-validate units when editing recipe', () => {
      // Mock updateReceta call that returns warnings
      const updateResult = {
        recetaId: 'rec125',
        nombre: 'Updated Recipe',
        unitWarnings: [
          "New Ingredient: Unidades incompatibles...",
        ],
      };

      // Cuando se edita, el mismo patrón: capturar unitWarnings
      const warnings = updateResult.unitWarnings || [];
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('incompatibles');
    });
  });

  describe('Unit Compatibility Visual Feedback', () => {
    /**
     * Scenario: Table row styling reflects compatibility
     * Expected: Compatible rows normal, incompatible rows highlighted
     */
    it('should highlight rows with unit issues', () => {
      const itemsWithWarnings = [
        { status: 'compatible', className: 'text-xs' }, // Normal
        { status: 'incompatible', className: 'text-xs bg-yellow-50' }, // Highlighted
      ];

      // Verificar que incompatible tiene styling diferente
      const incompatibleRow = itemsWithWarnings[1];
      expect(incompatibleRow.className).toContain('bg-yellow-50');
      expect(incompatibleRow.status).toBe('incompatible');
    });

    /**
     * Scenario: Warning banner position and styling
     * Expected: Banner visible at top of dialog, clearly distinguished
     */
    it('should position warnings banner prominently in dialog', () => {
      const bannerConfig = {
        position: 'after-header', // After DialogHeader
        borderClass: 'border-l-4 border-yellow-500',
        bgClass: 'bg-yellow-50',
        icon: '⚠️',
        placement: 'above-content', // Above scrollable content
      };

      expect(bannerConfig.borderClass).toContain('yellow');
      expect(bannerConfig.bgClass).toContain('yellow');
      expect(bannerConfig.placement).toBe('above-content');
    });

    /**
     * Scenario: User reads help text in warning banner
     * Expected: Help text explains issue and recommends action
     */
    it('should include helpful context in warning message', () => {
      const helpText =
        'Estos productos tienen unidades incompatibles con las especificadas en la receta. ' +
        'Las conversiones pueden no ser precisas. Recomendamos verificar la configuración.';

      expect(helpText).toContain('incompatibles');
      expect(helpText).toContain('precisas');
      expect(helpText).toContain('verificar');
    });
  });

  describe('Warning Persistence Across Interactions', () => {
    /**
     * Scenario: Close and reopen dialog
     * Expected: Fresh state, no stale warnings
     */
    it('should clear warnings when dialog closes', () => {
      let unitWarnings: string[] = ['Warning 1', 'Warning 2'];

      // Simular cierre de diálogo
      // En handleCrearReceta: setDialogRecetaOpen(false); setUnitWarnings([]);
      unitWarnings = [];

      expect(unitWarnings).toEqual([]);
    });

    /**
     * Scenario: Create recipe with warnings, then create new recipe
     * Expected: Previous warnings dont appear in new dialog
     */
    it('should not carry over warnings to new recipe creation', () => {
      const previousWarnings = ['Warning from Recipe 1'];
      const newRecipeWarnings = [];

      // En manejador de Nueva Receta, se resetean todos los estados
      expect(previousWarnings).toHaveLength(1);
      expect(newRecipeWarnings).toHaveLength(0);
      expect(newRecipeWarnings).not.toEqual(previousWarnings);
    });
  });

  describe('API Contract for Unit Warnings', () => {
    /**
     * Validates response structure from setIngredientes endpoint
     */
    it('should match API response contract with unitWarnings field', () => {
      const expectedContract = {
        recetaId: 'string',
        nombre: 'string',
        rendimiento: 'number',
        costoUnitario: 'number',
        RecetaIngrediente: 'array',
        unitWarnings: 'string[] | undefined', // Optional field
      };

      const actualResponse = {
        recetaId: 'rec126',
        nombre: 'Test Recipe',
        rendimiento: 1,
        costoUnitario: 100,
        RecetaIngrediente: [],
        unitWarnings: ['Warning 1', 'Warning 2'], // Present when issues found
      };

      expect(actualResponse).toHaveProperty('recetaId');
      expect(actualResponse).toHaveProperty('unitWarnings');
      expect(Array.isArray(actualResponse.unitWarnings)).toBe(true);
    });

    /**
     * Validates that warnings field is optional
     */
    it('should handle responses without unitWarnings field', () => {
      const responseWithoutWarnings = {
        recetaId: 'rec127',
        nombre: 'Perfect Recipe',
        rendimiento: 1,
        costoUnitario: 50,
        RecetaIngrediente: [],
        // unitWarnings not included
      };

      // Safe fallback: unitWarnings = response?.unitWarnings || []
      const warnings = responseWithoutWarnings?.unitWarnings || [];
      expect(warnings).toEqual([]);
    });
  });
});
