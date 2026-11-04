import { describe, expect, it } from 'vitest';
import {
  explodeBom,
  validateBomAcyclic,
  type BomRecipe,
} from '../bom';

const recipeGraph: BomRecipe[] = [
  {
    recetaId: 'P',
    productoId: 'product-P',
    rendimiento: 1,
    ingredientes: [{ recetaIngredienteId: 'S', cantidad: 2, desperdicio: 0 }],
  },
  {
    recetaId: 'S',
    productoId: 'product-S',
    rendimiento: 1,
    ingredientes: [{ productoId: 'I', cantidad: 3, desperdicio: 0 }],
  },
];

describe('BOM de producción multinivel', () => {
  it('detecta y rechaza el ciclo A → B → A', () => {
    const cyclicRecipes: BomRecipe[] = [
      {
        recetaId: 'A',
        rendimiento: 1,
        ingredientes: [{ recetaIngredienteId: 'B', cantidad: 1, desperdicio: 0 }],
      },
      {
        recetaId: 'B',
        rendimiento: 1,
        ingredientes: [{ recetaIngredienteId: 'A', cantidad: 1, desperdicio: 0 }],
      },
    ];

    expect(() => validateBomAcyclic(cyclicRecipes)).toThrowError(
      expect.objectContaining({ code: 'BOM_CYCLE' }),
    );
  });

  it('explota 10 P en 20 S y 60 unidades del ingrediente I', () => {
    const result = explodeBom('P', 10, recipeGraph);

    expect(result.subrecipes).toEqual([
      { recetaId: 'S', productoId: 'product-S', cantidad: 20 },
    ]);
    expect(result.materiales).toEqual([{ productoId: 'I', cantidad: 60 }]);
  });

  it('divide por el rendimiento de cada receta y aplica desperdicio', () => {
    const graph: BomRecipe[] = [
      {
        recetaId: 'P',
        rendimiento: 2,
        ingredientes: [{ recetaIngredienteId: 'S', cantidad: 4, desperdicio: 0.25 }],
      },
      {
        recetaId: 'S',
        rendimiento: 2,
        ingredientes: [{ productoId: 'I', cantidad: 3, desperdicio: 0.1 }],
      },
    ];

    const result = explodeBom('P', 10, graph);

    expect(result.subrecipes[0]).toMatchObject({ recetaId: 'S', cantidad: 25 });
    expect(result.materiales[0]).toEqual({ productoId: 'I', cantidad: 41.25 });
  });

  it('rechaza una receta con rendimiento cero', () => {
    const graph: BomRecipe[] = [
      { recetaId: 'P', rendimiento: 0, ingredientes: [] },
    ];

    expect(() => explodeBom('P', 1, graph)).toThrow('rendimiento');
  });
});
