import { deriveCategoryInsights } from '../category-insights';
import type { CategoriaResumen } from '../category-insights';

const cat = (over: Partial<CategoriaResumen>): CategoriaResumen => ({
  categoriaId: crypto.randomUUID(),
  nombre: 'Categoría',
  cantidadProductos: 2,
  stockTotal: 10,
  valorTotal: 100,
  valorVenta: 150,
  ...over,
});

describe('deriveCategoryInsights', () => {
  it('dataset vacío → sin insights', () => {
    expect(deriveCategoryInsights([])).toEqual([]);
  });

  it('dominancia muestra nombre y porcentaje exactos', () => {
    const rows = [
      cat({ nombre: 'Bebidas', valorTotal: 620, valorVenta: 930 }),
      cat({ nombre: 'Snacks', valorTotal: 380, valorVenta: 570 }),
    ];
    const dominante = deriveCategoryInsights(rows).find((i) => i.id === 'dominante');
    expect(dominante?.titulo).toBe('Bebidas domina el inventario');
    expect(dominante?.detalle).toBe('Concentra el 62.0% del valor');
  });

  it('cola larga usa el umbral del 5% compartido con el pie', () => {
    const rows = [
      cat({ nombre: 'Grande', valorTotal: 950 }),
      cat({ nombre: 'Mini A', valorTotal: 40 }),
      cat({ nombre: 'Mini B', valorTotal: 10 }),
    ];
    const cola = deriveCategoryInsights(rows).find((i) => i.id === 'cola_larga');
    expect(cola?.titulo).toBe('2 categorías son cola larga');
  });

  it('alerta cuando una categoría vende bajo costo', () => {
    const rows = [
      cat({ nombre: 'Loss', valorTotal: 100, valorVenta: 90 }),
      cat({ nombre: 'Sana', valorTotal: 100, valorVenta: 150 }),
    ];
    const alerta = deriveCategoryInsights(rows).find((i) => i.id === 'margen_bajo_costo');
    expect(alerta?.tono).toBe('alerta');
    expect(alerta?.titulo).toBe('1 categoría vende bajo costo');
    expect(alerta?.detalle).toContain('Loss');
  });

  it('agrupa quiebres por categoría con nombres', () => {
    const a = cat({ categoriaId: 'a', nombre: 'Bebidas' });
    const b = cat({ categoriaId: 'b', nombre: 'Snacks' });
    const quiebres = new Map<string, number>([['a', 2], ['b', 1]]);
    const quiebre = deriveCategoryInsights([a, b], quiebres).find((i) => i.id === 'sin_stock');
    expect(quiebre?.titulo).toBe('3 productos bajo stock mínimo');
    expect(quiebre?.detalle).toBe('Bebidas (2), Snacks (1)');
  });

  it('mejor margen elige el máximo y no aparece si todo está bajo costo', () => {
    const rows = [
      cat({ nombre: 'Baja', valorTotal: 100, valorVenta: 110 }), // 10%
      cat({ nombre: 'Alta', valorTotal: 100, valorVenta: 200 }), // 100%
    ];
    const margen = deriveCategoryInsights(rows).find((i) => i.id === 'mejor_margen');
    expect(margen?.titulo).toBe('Mejor margen: Alta');
    expect(margen?.detalle).toBe('100.0% de margen sobre costo');
  });

  it('las alertas van primero en la lista', () => {
    const rows = [cat({ nombre: 'Loss', valorTotal: 100, valorVenta: 90 })];
    const insights = deriveCategoryInsights(rows);
    expect(insights[0].tono).toBe('alerta');
  });
});
