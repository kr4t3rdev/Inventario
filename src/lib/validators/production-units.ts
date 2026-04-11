/**
 * @description Validador de unidades de medida para módulo de producción.
 * Garantiza consistencia entre unidades en recetas e inventario.
 */

import { convertBetweenUnits, MASS_UNITS, VOLUME_UNITS } from '@/lib/utils/unit-converter';

export type UnitCategory = 'mass' | 'volume' | 'unit' | 'unknown';
export type UnitErrorReason =
  | 'incompatible_category'
  | 'missing_unit'
  | 'unknown_unit'
  | 'missing_product';

export interface UnitNormalization {
  productoId: string;
  productoNombre: string;
  providedUnit: string | null;
  canonicalUnit: string | null;
  originalCantidad: number;
  normalizedCantidad: number;
}

export interface UnitError {
  productoId: string;
  productoNombre: string | null;
  providedUnit: string | null;
  canonicalUnit: string | null;
  reason: UnitErrorReason;
}

/**
 * @description Categoriza una unidad en mass, volume, unit o unknown
 * @param {string | null | undefined} simbolo - Símbolo de unidad
 * @returns {UnitCategory} Categoría de la unidad
 */
export function categorizeUnit(simbolo: string | null | undefined): UnitCategory {
  if (!simbolo) {
    return 'unit';
  }

  const normalized = simbolo.trim().toLowerCase();

  // Unidades sin conversión (pieza, unidad, etc)
  if (normalized === 'unidad' || normalized === 'pieza') {
    return 'unit';
  }

  // Masas
  if (MASS_UNITS.includes(normalized as any)) {
    return 'mass';
  }

  // Volumen (normalizar 'l' a 'L' para comparación)
  if (normalized === 'l' || VOLUME_UNITS.includes(normalized as any)) {
    return 'volume';
  }

  return 'unknown';
}

/**
 * @description Categoriza la unidad canónica del producto en catálogo.
 * Las unidades no convertibles del catálogo se interpretan como consumo de unidad completa.
 * @param {string | null | undefined} simbolo - Símbolo de unidad del producto en inventario.
 * @returns {UnitCategory} Categoría funcional de la unidad de catálogo.
 */
export function categorizeCatalogUnit(simbolo: string | null | undefined): UnitCategory {
  const category = categorizeUnit(simbolo);
  return category === 'unknown' ? 'unit' : category;
}

/**
 * @description Validación de compatibilidad entre unidades
 * @param {string | null | undefined} recetaUnit - Unidad definida en la receta
 * @param {string | null | undefined} productoUnit - Unidad del producto en el catálogo
 * @returns {object} Objeto con status y mensaje de error
 *
 * @example
 * validateUnitCompatibility('kg', 'g')
 * // returns { isCompatible: true, warning: null }
 *
 * @example
 * validateUnitCompatibility('L', 'kg')
 * // returns { isCompatible: false, warning: 'Unidades incompatibles: volumen vs masa' }
 */
export function validateUnitCompatibility(
  recetaUnit: string | null | undefined,
  productoUnit: string | null | undefined
): { isCompatible: boolean; warning: string | null } {
  const recetaCategory = categorizeUnit(recetaUnit);
  const productoCategory = categorizeCatalogUnit(productoUnit);

  // La unidad ingresada por el usuario sigue siendo estricta.
  if (recetaCategory === 'unknown') {
    return {
      isCompatible: false,
      warning: `Unidad desconocida: "${recetaUnit}". Asegúrate de que sea válida.`,
    };
  }

  // Si ambas son 'unit', compatible
  if (recetaCategory === 'unit' && productoCategory === 'unit') {
    return { isCompatible: true, warning: null };
  }

  // Si uno es 'unit' y otro no, incompatible
  if (
    (recetaCategory === 'unit' && productoCategory !== 'unit') ||
    (recetaCategory !== 'unit' && productoCategory === 'unit')
  ) {
    return {
      isCompatible: false,
      warning: `Inconsistencia: receta usa ${recetaCategory}, producto usa ${productoCategory}`,
    };
  }

  // Si ambas son masa, compatible
  if (recetaCategory === 'mass' && productoCategory === 'mass') {
    return { isCompatible: true, warning: null };
  }

  // Si ambas son volumen, compatible
  if (recetaCategory === 'volume' && productoCategory === 'volume') {
    return { isCompatible: true, warning: null };
  }

  // Si son diferentes (una masa, otra volumen), incompatible
  return {
    isCompatible: false,
    warning: `Unidades incompatibles: la receta usa ${recetaCategory} pero el producto usa ${productoCategory}`,
  };
}

/**
 * @description Valida una lista de ingredientes contra los productos del catálogo
 * @param {Array} ingredientes - Lista de ingredientes con productoId y unidadSimbolo
 * @param {Array} productos - Lista de productos del catálogo con id y unidadSimbolo
 * @returns {object} Lista de validaciones
 *
 * @returns {Array} Array de objetos con validación por ingrediente
 *   - productoId: ID del producto
 *   - isValid: booleano
 *   - warning: string o null
 *   - productoNombre: nombre del producto (si existe)
 */
export function validateIngredientsUnits(
  ingredientes: Array<{ productoId: string; unidadSimbolo?: string | null }>,
  productos: Array<{ id: string; nombre: string; unidadSimbolo?: string | null }>
): Array<{
  productoId: string;
  isValid: boolean;
  warning: string | null;
  productoNombre: string | null;
}> {
  return ingredientes.map((ing) => {
    const producto = productos.find((p) => p.id === ing.productoId);

    if (!producto) {
      return {
        productoId: ing.productoId,
        isValid: false,
        warning: 'Producto no encontrado en catálogo',
        productoNombre: null,
      };
    }

    const { isCompatible, warning } = validateUnitCompatibility(ing.unidadSimbolo, producto.unidadSimbolo);

    return {
      productoId: ing.productoId,
      isValid: isCompatible,
      warning: isCompatible ? null : `${producto.nombre}: ${warning}`,
      productoNombre: producto.nombre,
    };
  });
}

/**
 * @description Valida y normaliza un ingrediente hacia la unidad canónica del producto.
 * @param {{ productoId: string; cantidad: number; unidadSimbolo?: string | null }} ingrediente - Ingrediente a validar.
 * @param {{ id: string; nombre: string; unidadSimbolo?: string | null }} producto - Producto del catálogo.
 * @returns {{
 *   isValid: boolean;
 *   normalizedCantidad?: number;
 *   normalizedUnidadSimbolo?: string | null;
 *   normalization: UnitNormalization | null;
 *   error?: UnitError;
 * }} Resultado de validación y normalización.
 */
export function validateAndNormalizeIngredientUnit(
  ingrediente: { productoId: string; cantidad: number; unidadSimbolo?: string | null },
  producto: { id: string; nombre: string; unidadSimbolo?: string | null }
): {
  isValid: boolean;
  normalizedCantidad?: number;
  normalizedUnidadSimbolo?: string | null;
  normalization: UnitNormalization | null;
  error?: UnitError;
} {
  const providedUnit = ingrediente.unidadSimbolo ?? null;
  const canonicalUnit = producto.unidadSimbolo ?? null;
  const providedCategory = categorizeUnit(providedUnit);
  const canonicalCategory = categorizeCatalogUnit(canonicalUnit);

  if (providedCategory === 'unknown') {
    return {
      isValid: false,
      normalization: null,
      error: {
        productoId: ingrediente.productoId,
        productoNombre: producto.nombre,
        providedUnit,
        canonicalUnit,
        reason: 'unknown_unit',
      },
    };
  }

  if ((providedUnit === null || providedUnit === '') && (canonicalCategory === 'mass' || canonicalCategory === 'volume')) {
    return {
      isValid: false,
      normalization: null,
      error: {
        productoId: ingrediente.productoId,
        productoNombre: producto.nombre,
        providedUnit: null,
        canonicalUnit,
        reason: 'missing_unit',
      },
    };
  }

  if (canonicalCategory === 'unit' && providedCategory === 'unit') {
    const normalizedCantidad = ingrediente.cantidad;
    const normalizedUnidadSimbolo = canonicalUnit ?? providedUnit;
    const normalization =
      providedUnit !== normalizedUnidadSimbolo || normalizedCantidad !== ingrediente.cantidad
        ? {
            productoId: ingrediente.productoId,
            productoNombre: producto.nombre,
            providedUnit,
            canonicalUnit,
            originalCantidad: ingrediente.cantidad,
            normalizedCantidad,
          }
        : null;

    return {
      isValid: true,
      normalizedCantidad,
      normalizedUnidadSimbolo,
      normalization,
    };
  }

  if (canonicalCategory !== providedCategory) {
    return {
      isValid: false,
      normalization: null,
      error: {
        productoId: ingrediente.productoId,
        productoNombre: producto.nombre,
        providedUnit,
        canonicalUnit,
        reason: 'incompatible_category',
      },
    };
  }

  const normalizedCantidad = convertBetweenUnits(ingrediente.cantidad, providedUnit, canonicalUnit);
  const normalizedUnidadSimbolo = canonicalUnit;
  const normalization =
    providedUnit !== normalizedUnidadSimbolo || normalizedCantidad !== ingrediente.cantidad
      ? {
          productoId: ingrediente.productoId,
          productoNombre: producto.nombre,
          providedUnit,
          canonicalUnit,
          originalCantidad: ingrediente.cantidad,
          normalizedCantidad,
        }
      : null;

  return {
    isValid: true,
    normalizedCantidad,
    normalizedUnidadSimbolo,
    normalization,
  };
}

/**
 * @description Obtiene sugerencia de unidad para un producto basado en su categoría
 * @param {UnitCategory} category - Categoría detectada
 * @returns {Array<string>} Unidades sugeridas
 */
export function suggestUnitsByCategory(category: UnitCategory): string[] {
  switch (category) {
    case 'mass':
      return ['g', 'kg', 'lb', 'oz'];
    case 'volume':
      return ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup'];
    case 'unit':
      return ['unidad', 'pieza'];
    default:
      return [];
  }
}
