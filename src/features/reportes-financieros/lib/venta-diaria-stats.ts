/**
 * @description Helpers puros para las estadísticas del reporte Venta Diaria.
 * Reglas de negocio centrales (corrección de la auditoría de datos 2026-09-16):
 * - "Total de Ventas" cuenta DOCUMENTOS de venta distintos, no líneas.
 * - El ticket promedio divide entre documentos de productos + servicios vendidos.
 * - El costo del día usa lotes FIFO reales cuando existen allocations; si una
 *   línea no tiene allocations (venta sin lote, legacy), cae al precioCosto actual.
 */

/** Línea aplanada mínima necesaria para las estadísticas. */
export interface LineaEstadistica {
  ventaId: string
  cantidad: number
  totalLinea: number
  descuento: number
  /** Costo FIFO total de la línea (Σ allocations.cantidad × costo del lote); null si no hubo allocations. */
  costoFifo?: number | null
  producto?: { precioCosto?: number } | null
}

/**
 * @description Cuenta los documentos de venta distintos presentes en líneas aplanadas.
 * @param {LineaEstadistica[]} lineas - Líneas del día.
 * @returns {number} Cantidad de ventas (documentos).
 */
export function contarVentasDistintas(lineas: LineaEstadistica[]): number {
  return new Set(lineas.map((linea) => linea.ventaId)).size;
}

/**
 * @description Ticket promedio del día: ingresos netos / (documentos de producto + servicios).
 * @param {number} ingresosNetos - Ingresos netos en moneda funcional.
 * @param {number} totalVentas - Documentos de venta de productos.
 * @param {number} totalServicios - Documentos de servicio.
 * @returns {number} Ticket promedio; 0 si no hubo transacciones.
 */
export function calcularTicketPromedio(
  ingresosNetos: number,
  totalVentas: number,
  totalServicios: number,
): number {
  const transacciones = totalVentas + totalServicios;
  if (transacciones <= 0) return 0;
  return ingresosNetos / transacciones;
}

/** Documento de venta mínimo para contabilizar devoluciones. */
export interface VentaDocStats {
  devoluciones?: Array<{ estado?: string; total?: number | string }> | null
  deletedAt?: string | Date | null
}

/**
 * @description Suma el total ya neteado por notas de crédito REGISTRADAS de las
 * ventas del período. Es el complemento de la convención FIFO del costo: una
 * devolución registrada ya rebajó las allocations de su venta, así que el ingreso
 * debe netearse igual para no inflar la ganancia del día (auditoría datos 2026-09-17).
 * @param {VentaDocStats[]} ventas - Documentos de venta del período.
 * @returns {number} Total a restar de ingresos netos.
 */
export function calcularDevolucionesNetas(ventas: VentaDocStats[]): number {
  let total = 0;
  for (const venta of ventas) {
    if (venta.deletedAt) continue; // anuladas: no se contabilizan dos veces
    for (const devolucion of venta.devoluciones ?? []) {
      if (devolucion.estado !== 'REGISTRADA') continue;
      total += Number(devolucion.total ?? 0);
    }
  }
  return total;
}

/**
 * @description Costo total de las líneas del día.
 * Usa el costo FIFO real de cada línea cuando existe (PurchaseAllocation);
 * para líneas sin allocations aplica cantidad × precioCosto como fallback
 * y lo marca en el resultado.
 * @param {LineaEstadistica[]} lineas - Líneas del período.
 * @returns {{ costoTotal: number; usaFifoCompleto: boolean }} Costo agregado y si
 * todas las líneas usaron FIFO (sin mezcla con estimación).
 */
export function calcularCostoTotalDia(lineas: LineaEstadistica[]): {
  costoTotal: number
  usaFifoCompleto: boolean
} {
  let costoTotal = 0;
  let lineasConFifo = 0;

  for (const linea of lineas) {
    if (linea.costoFifo != null) {
      costoTotal += linea.costoFifo;
      lineasConFifo += 1;
    } else {
      costoTotal += linea.cantidad * (linea.producto?.precioCosto ?? 0);
    }
  }

  return {
    costoTotal,
    usaFifoCompleto: lineas.length > 0 && lineasConFifo === lineas.length,
  };
}
