/**
 * @description Derivaciones puras para el panel "Lectura rápida" de la pestaña
 * Categoría. Reemplaza la tabla-resumen duplicada (la tabla detalle completa ya
 * existe debajo); el panel sintetiza qué categoría domina el valor, la cola
 * larga, el mejor margen y los riesgos de quiebre — leído en 10 segundos.
 */
export interface CategoriaResumen {
  categoriaId: string
  nombre: string
  cantidadProductos: number
  stockTotal: number
  valorTotal: number
  valorVenta: number
}

export interface CategoryInsight {
  /** Identificador estable para tests/estilos. */
  id: 'dominante' | 'cola_larga' | 'mejor_margen' | 'margen_bajo_costo' | 'sin_stock'
  tono: 'info' | 'alerta'
  /** Texto principal, una línea. */
  titulo: string
  /** Detalle cuantificado. */
  detalle: string
}

/** Umbral compartido con la etiqueta del pie: participación menor al 5%. */
const UMBRAL_COLA = 0.05;

/**
 * @description Calcula los insights accionables de la distribución por categoría.
 * Orden: alertas primero (quiebres, margen bajo costo), luego dominancia y margen.
 * @param {CategoriaResumen[]} categorias - Filas agregadas por categoría.
 * @param {Map<string, number>} [quiebresPorCategoria] - Cantidad de productos bajo
 * stock mínimo por categoría (opcional; si se omite no se emite insight de quiebre).
 * @returns {CategoryInsight[]} Lista ordenada prioridad-primero (máx. 5).
 */
export function deriveCategoryInsights(
  categorias: CategoriaResumen[],
  quiebresPorCategoria?: Map<string, number>,
): CategoryInsight[] {
  const validas = categorias.filter((c) => c.valorTotal >= 0);
  if (validas.length === 0) return [];

  const totalValor = validas.reduce((sum, c) => sum + c.valorTotal, 0);
  const insights: CategoryInsight[] = [];

  // Alertas primero: categorías vendiendo bajo costo
  const bajoCosto = validas.filter((c) => c.valorTotal > 0 && c.valorVenta < c.valorTotal);
  if (bajoCosto.length > 0) {
    insights.push({
      id: 'margen_bajo_costo',
      tono: 'alerta',
      titulo: `${bajoCosto.length} ${bajoCosto.length === 1 ? 'categoría vende' : 'categorías venden'} bajo costo`,
      detalle: bajoCosto.map((c) => c.nombre).join(', '),
    });
  }

  // Quiebres: productos bajo stock mínimo por categoría
  if (quiebresPorCategoria) {
    const conQuiebre = [...quiebresPorCategoria.entries()].filter(([, n]) => n > 0);
    if (conQuiebre.length > 0) {
      const totalProductos = conQuiebre.reduce((sum, [, n]) => sum + n, 0);
      const nombres = new Map(validas.map((c) => [c.categoriaId, c.nombre]));
      insights.push({
        id: 'sin_stock',
        tono: 'alerta',
        titulo: `${totalProductos} ${totalProductos === 1 ? 'producto bajo' : 'productos bajo'} stock mínimo`,
        detalle: conQuiebre
          .map(([id, n]) => `${nombres.get(id) ?? 'Sin categoría'} (${n})`)
          .join(', '),
      });
    }
  }

  // Dominancia: la categoría con más valor y su participación
  const ordenadas = [...validas].sort((a, b) => b.valorTotal - a.valorTotal);
  const top = ordenadas[0];
  if (totalValor > 0 && top.valorTotal > 0) {
    insights.push({
      id: 'dominante',
      tono: 'info',
      titulo: `${top.nombre} domina el inventario`,
      detalle: `Concentra el ${((top.valorTotal / totalValor) * 100).toFixed(1)}% del valor`,
    });
  }

  // Cola larga: categorías con participación < 5% (mismo umbral que las etiquetas del pie)
  if (totalValor > 0) {
    const cola = validas.filter((c) => c.valorTotal / totalValor < UMBRAL_COLA);
    if (cola.length > 0) {
      insights.push({
        id: 'cola_larga',
        tono: 'info',
        titulo: `${cola.length} ${cola.length === 1 ? 'categoría es' : 'categorías son'} cola larga`,
        detalle: 'Cada una aporta menos del 5% del valor; evalúa consolidarlas',
      });
    }
  }

  // Mejor margen (valor venta vs valor costo)
  const conMargen = validas
    .filter((c) => c.valorTotal > 0 && c.valorVenta >= c.valorTotal)
    .map((c) => ({ categoria: c, margen: (c.valorVenta - c.valorTotal) / c.valorTotal }));
  if (conMargen.length > 0) {
    const mejor = conMargen.reduce((max, m) => (m.margen > max.margen ? m : max));
    insights.push({
      id: 'mejor_margen',
      tono: 'info',
      titulo: `Mejor margen: ${mejor.categoria.nombre}`,
      detalle: `${(mejor.margen * 100).toFixed(1)}% de margen sobre costo`,
    });
  }

  return insights.slice(0, 5);
}
