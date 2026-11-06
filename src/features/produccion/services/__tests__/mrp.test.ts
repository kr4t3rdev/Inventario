import { describe, expect, it } from 'vitest';
import { planificarNecesidades } from '../mrp';
import type { BomRecipe } from '../bom';

const recetas: BomRecipe[] = [
  {
    recetaId: 'P', productoId: 'producto-P', rendimiento: 1,
    ingredientes: [{ recetaIngredienteId: 'S', cantidad: 2 }],
  },
  {
    recetaId: 'S', productoId: 'producto-S', rendimiento: 1,
    ingredientes: [{ productoId: 'I', cantidad: 3 }],
  },
];

describe('planificarNecesidades', () => {
  it('explota la demanda, netea stock y sugiere compras y producción', () => {
    expect(planificarNecesidades('P', 10, recetas, [
      { productoId: 'I', cantidadDisponible: 18 },
    ])).toEqual({
      materiales: [{
        productoId: 'I', cantidadRequerida: 60, cantidadDisponible: 18, cantidadComprar: 42,
      }],
      ordenesProduccion: [
        { recetaId: 'P', productoId: 'producto-P', cantidad: 10 },
        { recetaId: 'S', productoId: 'producto-S', cantidad: 20 },
      ],
    });
  });

  it('agrega balances por producto y no sugiere compra con disponibilidad suficiente', () => {
    const plan = planificarNecesidades('P', 1, recetas, [
      { productoId: 'I', cantidadDisponible: 2 },
      { productoId: 'I', cantidadDisponible: 4 },
    ]);

    expect(plan.materiales[0]).toMatchObject({
      cantidadRequerida: 6, cantidadDisponible: 6, cantidadComprar: 0,
    });
  });

  it('descuenta stock de subreceta antes de calcular materiales y fabricación', () => {
    expect(planificarNecesidades('P', 10, recetas, [
      { productoId: 'producto-S', cantidadDisponible: 5 },
      { productoId: 'I', cantidadDisponible: 18 },
    ])).toEqual({
      materiales: [{
        productoId: 'I', cantidadRequerida: 45, cantidadDisponible: 18, cantidadComprar: 27,
      }],
      ordenesProduccion: [
        { recetaId: 'P', productoId: 'producto-P', cantidad: 10 },
        { recetaId: 'S', productoId: 'producto-S', cantidad: 15 },
      ],
    });
  });

  it('ignora residuos de precisión cuando el stock cubre exactamente la demanda', () => {
    const recetaSubreceta: BomRecipe[] = [
      {
        recetaId: 'P', productoId: 'producto-P', rendimiento: 1,
        ingredientes: [{ recetaIngredienteId: 'S', cantidad: 50, desperdicio: 0.1 }],
      },
      { recetaId: 'S', productoId: 'producto-S', rendimiento: 1, ingredientes: [] },
    ];
    const planSubreceta = planificarNecesidades('P', 1, recetaSubreceta, [
      { productoId: 'producto-S', cantidadDisponible: 55 },
    ]);

    expect(planSubreceta.ordenesProduccion).toEqual([
      { recetaId: 'P', productoId: 'producto-P', cantidad: 1 },
    ]);

    const recetaMaterial: BomRecipe[] = [{
      recetaId: 'P', productoId: 'producto-P', rendimiento: 1,
      ingredientes: [{ productoId: 'I', cantidad: 50, desperdicio: 0.1 }],
    }];
    expect(planificarNecesidades('P', 1, recetaMaterial, [
      { productoId: 'I', cantidadDisponible: 55 },
    ]).materiales[0].cantidadComprar).toBe(0);
  });
});
