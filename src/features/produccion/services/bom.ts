/**
 * @description Representación tipada de un ingrediente de producto terminado.
 */
export interface BomProductIngredient {
  productoId: string;
  recetaIngredienteId?: null;
  cantidad: number;
  desperdicio?: number;
}

/**
 * @description Representación tipada de un ingrediente que referencia una subreceta.
 */
export interface BomRecipeIngredient {
  productoId?: null;
  recetaIngredienteId: string;
  cantidad: number;
  desperdicio?: number;
}

/**
 * @description Ingrediente válido de una receta: producto de inventario o subreceta.
 */
export type BomIngredient = BomProductIngredient | BomRecipeIngredient;

/**
 * @description Receta y sus ingredientes, independiente de Prisma para permitir cálculo puro.
 */
export interface BomRecipe {
  recetaId: string;
  productoId?: string | null;
  rendimiento: number;
  ingredientes: BomIngredient[];
}

/**
 * @description Requerimiento acumulado de una subreceta dentro de la explosión.
 */
export interface BomSubrecipeRequirement {
  recetaId: string;
  productoId: string | null;
  cantidad: number;
}

/**
 * @description Requerimiento acumulado de un producto de inventario dentro de la explosión.
 */
export interface BomMaterialRequirement {
  productoId: string;
  cantidad: number;
}

/**
 * @description Resultado de explotar una receta hasta sus materiales hoja.
 */
export interface BomExplosion {
  subrecipes: BomSubrecipeRequirement[];
  materiales: BomMaterialRequirement[];
}

/**
 * @description Error de dominio con código estable para validaciones de BOM.
 */
export class BomError extends Error {
  constructor(
    message: string,
    public readonly code: 'BOM_CYCLE' | 'BOM_RECIPE_NOT_FOUND' | 'BOM_INVALID_QUANTITY',
    public readonly path: readonly string[] = [],
  ) {
    super(message);
    this.name = 'BomError';
  }
}

/**
 * @description Valida que el grafo completo de recetas no contenga ciclos ni referencias huérfanas.
 * @param {readonly BomRecipe[]} recipes - Recetas del mismo tenant a validar.
 * @returns {void} No retorna valor; lanza `BomError` si el grafo no es válido.
 */
export function validateBomAcyclic(recipes: readonly BomRecipe[]): void {
  const byId = new Map(recipes.map((recipe) => [recipe.recetaId, recipe]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const visit = (recetaId: string): void => {
    if (visiting.has(recetaId)) {
      const start = path.indexOf(recetaId);
      const cycle = [...path.slice(start), recetaId];
      throw new BomError(`Ciclo de subrecetas detectado: ${cycle.join(' → ')}`, 'BOM_CYCLE', cycle);
    }
    if (visited.has(recetaId)) return;

    const recipe = byId.get(recetaId);
    if (!recipe) {
      throw new BomError(`La subreceta ${recetaId} no existe en el tenant`, 'BOM_RECIPE_NOT_FOUND');
    }

    visiting.add(recetaId);
    path.push(recetaId);
    for (const ingredient of recipe.ingredientes) {
      if ('recetaIngredienteId' in ingredient && ingredient.recetaIngredienteId) {
        visit(ingredient.recetaIngredienteId);
      }
    }
    path.pop();
    visiting.delete(recetaId);
    visited.add(recetaId);
  };

  for (const recipe of recipes) visit(recipe.recetaId);
}

/**
 * @description Expande una receta en demanda agregada de subrecetas y materiales hoja.
 * @param {string} recetaId - Receta raíz que se desea producir.
 * @param {number} cantidadAProducir - Unidades de producto final requeridas.
 * @param {readonly BomRecipe[]} recipes - Grafo completo de recetas del tenant.
 * @returns {BomExplosion} Cantidades por subreceta y material directo agregado.
 */
export function explodeBom(
  recetaId: string,
  cantidadAProducir: number,
  recipes: readonly BomRecipe[],
): BomExplosion {
  if (!Number.isFinite(cantidadAProducir) || cantidadAProducir <= 0) {
    throw new BomError('La cantidad a producir debe ser mayor que cero', 'BOM_INVALID_QUANTITY');
  }

  validateBomAcyclic(recipes);
  const byId = new Map(recipes.map((recipe) => [recipe.recetaId, recipe]));
  const root = byId.get(recetaId);
  if (!root) {
    throw new BomError(`La receta ${recetaId} no existe en el tenant`, 'BOM_RECIPE_NOT_FOUND');
  }

  const subrecipeTotals = new Map<string, BomSubrecipeRequirement>();
  const materialTotals = new Map<string, number>();

  const expand = (currentId: string, outputQuantity: number): void => {
    const recipe = byId.get(currentId);
    if (!recipe) {
      throw new BomError(`La subreceta ${currentId} no existe en el tenant`, 'BOM_RECIPE_NOT_FOUND');
    }
    if (!Number.isFinite(recipe.rendimiento) || recipe.rendimiento <= 0) {
      throw new BomError(`El rendimiento de la receta ${currentId} debe ser mayor que cero`, 'BOM_INVALID_QUANTITY');
    }

    const batchFactor = outputQuantity / recipe.rendimiento;
    for (const ingredient of recipe.ingredientes) {
      const waste = ingredient.desperdicio ?? 0;
      if (!Number.isFinite(ingredient.cantidad) || ingredient.cantidad <= 0
        || !Number.isFinite(waste) || waste < 0 || waste > 1) {
        throw new BomError(`Cantidad o desperdicio inválido en la receta ${currentId}`, 'BOM_INVALID_QUANTITY');
      }

      const requiredQuantity = batchFactor * ingredient.cantidad * (1 + waste);
      if ('recetaIngredienteId' in ingredient && ingredient.recetaIngredienteId) {
        const childRecipe = byId.get(ingredient.recetaIngredienteId);
        if (!childRecipe) {
          throw new BomError(
            `La subreceta ${ingredient.recetaIngredienteId} no existe en el tenant`,
            'BOM_RECIPE_NOT_FOUND',
          );
        }
        const existing = subrecipeTotals.get(childRecipe.recetaId);
        subrecipeTotals.set(childRecipe.recetaId, {
          recetaId: childRecipe.recetaId,
          productoId: childRecipe.productoId ?? null,
          cantidad: (existing?.cantidad ?? 0) + requiredQuantity,
        });
        expand(childRecipe.recetaId, requiredQuantity);
      } else {
        const productId = ingredient.productoId;
        if (!productId) {
          throw new BomError('El ingrediente no tiene producto ni subreceta', 'BOM_RECIPE_NOT_FOUND');
        }
        materialTotals.set(productId, (materialTotals.get(productId) ?? 0) + requiredQuantity);
      }
    }
  };

  expand(recetaId, cantidadAProducir);

  return {
    subrecipes: [...subrecipeTotals.values()],
    materiales: [...materialTotals].map(([productoId, cantidad]) => ({ productoId, cantidad })),
  };
}
