import { BomError, explodeBom, type BomRecipe } from './bom';

export interface MrpStockBalance {
  productoId: string;
  cantidadDisponible: number;
}

export interface MrpMaterialSuggestion {
  productoId: string;
  cantidadRequerida: number;
  cantidadDisponible: number;
  cantidadComprar: number;
}

export interface MrpProductionSuggestion {
  recetaId: string;
  productoId: string | null;
  cantidad: number;
}

export interface MrpPlan {
  materiales: MrpMaterialSuggestion[];
  ordenesProduccion: MrpProductionSuggestion[];
}

/**
 * @description Calcula déficits netos de materiales y subrecetas para una demanda MRP.
 * @param {string} recetaId - Receta del producto cuya demanda se planifica.
 * @param {number} cantidad - Unidades del producto final requeridas.
 * @param {readonly BomRecipe[]} recetas - BOM completo del tenant.
 * @param {readonly MrpStockBalance[]} stock - Disponible actual por producto.
 * @returns {MrpPlan} Sugerencias sin crear órdenes ni modificar inventario.
 */
export function planificarNecesidades(
  recetaId: string,
  cantidad: number,
  recetas: readonly BomRecipe[],
  stock: readonly MrpStockBalance[],
): MrpPlan {
  explodeBom(recetaId, cantidad, recetas);
  const disponiblePorProducto = new Map<string, number>();
  const recetaPorId = new Map(recetas.map((recipe) => [recipe.recetaId, recipe]));

  for (const balance of stock) {
    if (!Number.isFinite(balance.cantidadDisponible) || balance.cantidadDisponible < 0) {
      throw new BomError('El stock disponible no es válido', 'BOM_INVALID_QUANTITY');
    }
    disponiblePorProducto.set(
      balance.productoId,
      (disponiblePorProducto.get(balance.productoId) ?? 0) + balance.cantidadDisponible,
    );
  }

  const materiales = new Map<string, MrpMaterialSuggestion>();
  const ordenes = new Map<string, MrpProductionSuggestion>();

  const expandir = (id: string, cantidadNecesaria: number): void => {
    const receta = recetaPorId.get(id);
    if (!receta) throw new BomError(`La receta ${id} no existe en el tenant`, 'BOM_RECIPE_NOT_FOUND');

    const stockProducto = receta.productoId
      ? disponiblePorProducto.get(receta.productoId) ?? 0
      : 0;
    const cantidadDisponible = Math.min(stockProducto, cantidadNecesaria);
    if (receta.productoId) {
      disponiblePorProducto.set(receta.productoId, stockProducto - cantidadDisponible);
    }
    const cantidadProducir = cantidadNecesaria - cantidadDisponible;
    if (cantidadProducir <= 0) return;

    const existing = ordenes.get(id);
    ordenes.set(id, {
      recetaId: id,
      productoId: receta.productoId ?? null,
      cantidad: (existing?.cantidad ?? 0) + cantidadProducir,
    });

    if (!Number.isFinite(receta.rendimiento) || receta.rendimiento <= 0) {
      throw new BomError(`El rendimiento de la receta ${id} debe ser mayor que cero`, 'BOM_INVALID_QUANTITY');
    }
    const factor = cantidadProducir / receta.rendimiento;
    for (const ingrediente of receta.ingredientes) {
      const desperdicio = ingrediente.desperdicio ?? 0;
      const requerido = factor * ingrediente.cantidad * (1 + desperdicio);
      if (ingrediente.recetaIngredienteId) {
        expandir(ingrediente.recetaIngredienteId, requerido);
        continue;
      }
      const productoId = ingrediente.productoId;
      if (!productoId) throw new BomError('El ingrediente no tiene producto ni subreceta', 'BOM_RECIPE_NOT_FOUND');
      const disponible = disponiblePorProducto.get(productoId) ?? 0;
      const usado = Math.min(disponible, requerido);
      disponiblePorProducto.set(productoId, disponible - usado);
      const actual = materiales.get(productoId);
      materiales.set(productoId, {
        productoId,
        cantidadRequerida: (actual?.cantidadRequerida ?? 0) + requerido,
        cantidadDisponible: (actual?.cantidadDisponible ?? 0) + usado,
        cantidadComprar: (actual?.cantidadComprar ?? 0) + requerido - usado,
      });
    }
  };

  expandir(recetaId, cantidad);
  return { materiales: [...materiales.values()], ordenesProduccion: [...ordenes.values()] };
}
