/**
 * @description Valoración FIFO del inventario actual a partir de lotes de compra.
 *
 * Regla: por cada lote (CompraDocumentoItem), quedan remanentes las unidades
 * compradas menos las ya alocadas netas a ventas (las devoluciones restauran las
 * allocations, así que el remanente refleja devoluciones sin código extra).
 * El valor del producto = Σ remanente × costo del lote.
 *
 * Reglas defensivas frente a datos imperfectos:
 * - Allocations que superen el lote (datos rotos): el remanente se acota a 0.
 * - Stock físico mayor al cubierto por lotes: el déficit se estima a precioCosto
 *   vigente y se marca `tieneEstimado`.
 * - Stock físico menor al cubierto por lotes (desajuste histórico): el valor FIFO
 *   se escala proporcionalmente al stock real y se marca `escalado`.
 */
export interface LoteCompra {
  id: string
  productoId: string
  cantidad: number
  precioUnitario: number
}

export interface ProductoBaseValuacion {
  productoId: string
  precioCosto: number
  stockTotal: number
}

export interface ValuacionProducto {
  productoId: string
  valorFifo: number
  unidadesFifo: number
  /** Unidades valoradas a precioCosto por no tener lote (parte estimada). */
  unidadesEstimadas: number
  tieneEstimado: boolean
  escalado: boolean
}

export interface ValuacionInventario {
  porProducto: ValuacionProducto[]
  valorTotalFifo: number
  valorTotalEstimado: number
  tieneEstimado: boolean
}

/**
 * @description Combina lotes de compra, totales alocados y stock físico en una
 * valoración FIFO neta por producto.
 * @param {LoteCompra[]} lotes - Líneas de compra (todos los estados no anulados).
 * @param {Map<string, number>} allocPorLote - Cantidad alocada neta por línea de compra.
 * @param {ProductoBaseValuacion[]} productos - Productos del tenant con stock físico.
 * @returns {ValuacionInventario} Valor por producto y totales del tenant.
 */
export function calcularValuacionFifo(
  lotes: LoteCompra[],
  allocPorLote: Map<string, number>,
  productos: ProductoBaseValuacion[],
): ValuacionInventario {
  // Remanente FIFO por producto a partir de lotes: ordenar de más viejo no es
  // necesario para el valor (solo importan cantidad remanente y precio del lote).
  const fifoPorProducto = new Map<string, { unidades: number; valor: number }>();

  for (const lote of lotes) {
    const alocado = allocPorLote.get(lote.id) ?? 0;
    const remanente = Math.max(0, lote.cantidad - alocado);
    if (remanente === 0) continue;
    const prev = fifoPorProducto.get(lote.productoId) ?? { unidades: 0, valor: 0 };
    fifoPorProducto.set(lote.productoId, {
      unidades: prev.unidades + remanente,
      valor: prev.valor + remanente * lote.precioUnitario,
    });
  }

  const porProducto: ValuacionProducto[] = [];
  let valorTotalFifo = 0;
  let valorTotalEstimado = 0;
  let tieneEstimado = false;

  for (const producto of productos) {
    const stock = Math.max(0, producto.stockTotal);
    const fifo = fifoPorProducto.get(producto.productoId) ?? { unidades: 0, valor: 0 };

    let valorFifo: number;
    let unidadesFifo: number;
    let escalado = false;

    if (fifo.unidades <= 0) {
      valorFifo = 0;
      unidadesFifo = 0;
    } else if (fifo.unidades > stock && fifo.unidades > 0) {
      // El histórico de lotes excede el stock real: escalar proporcionalmente.
      const factor = stock / fifo.unidades;
      valorFifo = Math.round(fifo.valor * factor * 100) / 100;
      unidadesFifo = stock;
      escalado = true;
    } else {
      valorFifo = fifo.valor;
      unidadesFifo = fifo.unidades;
    }

    const unidadesEstimadas = Math.max(0, stock - unidadesFifo);
    const valorEstimadoParte = unidadesEstimadas * producto.precioCosto;
    const tieneEstimadoProducto = unidadesEstimadas > 0;

    valorFifo += valorEstimadoParte;
    valorTotalFifo += valorFifo;
    valorTotalEstimado += valorEstimadoParte;
    tieneEstimado = tieneEstimado || tieneEstimadoProducto;

    porProducto.push({
      productoId: producto.productoId,
      valorFifo,
      unidadesFifo,
      unidadesEstimadas,
      tieneEstimado: tieneEstimadoProducto,
      escalado,
    });
  }

  return { porProducto, valorTotalFifo, valorTotalEstimado, tieneEstimado };
}
