import {
  validateAndNormalizeIngredientUnit,
  type ProductionUnitConversion,
} from '@/lib/validators/production-units';

export interface RecipeIngredientUnitInput {
  productoId: string;
  cantidad: number;
  unidadSimbolo: string | null;
  producto: {
    id: string;
    nombre: string;
    unidadSimbolo: string | null;
    unidadDimension: string | null;
    unidadesConversion?: ProductionUnitConversion[];
  };
}

/**
 * @description Normaliza las cantidades de ingredientes de receta a la unidad de stock del producto.
 * @param {readonly RecipeIngredientUnitInput[]} ingredients - Ingredientes con unidad y producto.
 * @returns {Array<{ productoId: string; cantidad: number; unidadSimbolo: string | null }>}
 * Ingredientes convertidos o error de validación.
 */
export function normalizeRecipeIngredientsToStock(
  ingredients: readonly RecipeIngredientUnitInput[],
): Array<{ productoId: string; cantidad: number; unidadSimbolo: string | null }> {
  return ingredients.map((ingredient) => {
    const result = validateAndNormalizeIngredientUnit(
      {
        productoId: ingredient.productoId,
        cantidad: ingredient.cantidad,
        unidadSimbolo: ingredient.unidadSimbolo,
      },
      ingredient.producto,
    );

    if (!result.isValid || result.normalizedCantidad === undefined) {
      throw new Error(
        `Unidad inválida para ${ingredient.producto.nombre}: ${result.error?.reason ?? 'conversión inválida'}`,
      );
    }

    return {
      productoId: ingredient.productoId,
      cantidad: result.normalizedCantidad,
      unidadSimbolo: result.normalizedUnidadSimbolo ?? ingredient.unidadSimbolo,
    };
  });
}
