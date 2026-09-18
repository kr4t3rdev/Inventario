import type { Venta } from '@/app/models/model'

/**
 * @description Línea normalizada de venta por producto.
 */
export interface VentaLinea {
  id: string
  ventaId: string
  productoId: string
  cantidad: number
  precioUnitario: number
  totalLinea: number
  descuento: number
  createdAt: string
  puntoDeVentaId: string
  puntoDeVenta?: Venta["puntoDeVenta"]
  puntoDeVentaNombre?: string
  cliente?: Venta["cliente"]
  producto?: Venta["producto"]
  productoNombre?: string
  productoCodigoInterno?: string
  /** Costo FIFO real de la línea (Σ allocations × costo del lote); null si no hubo allocations. */
  costoFifo?: number | null
}

/**
 * @description Convierte ventas legacy o con items en líneas por producto para reportes.
 * @param {Venta[] | undefined} ventas - Lista de ventas.
 * @returns {VentaLinea[]} Líneas normalizadas por producto.
 */
export function flattenVentas(ventas?: Venta[]): VentaLinea[] {
  if (!ventas || ventas.length === 0) {
    return []
  }

  const lineas: VentaLinea[] = []

  ventas.forEach((venta) => {
    const descuentoTotal = Number(venta.descuento ?? 0)

    if (venta.items && venta.items.length > 0) {
      const subtotalVenta = venta.items.reduce((sum, item) => {
        const itemTotal = Number(item.total ?? 0)
        return sum + (Number.isFinite(itemTotal) ? itemTotal : 0)
      }, 0)

      venta.items.forEach((item) => {
        const cantidad = Number(item.cantidad ?? 0)
        const precioUnitario = Number(
          item.precioUnitario ??
            item.producto?.precioVenta ??
            (cantidad > 0 ? Number(item.total ?? 0) / cantidad : 0),
        )
        const totalLinea = Number(item.total ?? precioUnitario * cantidad)
        const descuentoLinea = subtotalVenta > 0 ? descuentoTotal * (totalLinea / subtotalVenta) : 0
        const productoId = item.producto?.id || item.productoId

        if (!productoId) return

        // Costo FIFO agregado de la línea: viene de PurchaseAllocation (lotes reales).
        // null cuando la línea no tiene allocations (legacy/pedido no entregado);
        // 0 cuando la venta ya fue devuelta por completo — la devolución elimina
        // las allocations y sin regla el costo reaparecería por el fallback.
        const allocations = (item as { allocations?: Array<{ cantidad?: number; compraDocumentoItem?: { precioUnitario?: number } | null }> }).allocations
        const devoluciones = (venta as { devoluciones?: Array<{ estado?: string; total?: number | string }> }).devoluciones
        const totalDevuelto = (devoluciones ?? [])
          .filter((d) => d.estado === 'REGISTRADA')
          .reduce((sum, d) => sum + Number(d.total ?? 0), 0)
        const ventaTotal = Number(venta.total ?? 0)
        const ventaDevueltaCompleta = totalDevuelto > 0 && ventaTotal > 0 && totalDevuelto >= ventaTotal

        const costoFifo = Array.isArray(allocations) && allocations.length > 0
          ? allocations.reduce(
              (sum, alloc) => sum + Number(alloc.cantidad ?? 0) * Number(alloc.compraDocumentoItem?.precioUnitario ?? 0),
              0,
            )
          : ventaDevueltaCompleta
            ? 0
            : null

        lineas.push({
          id: item.id,
          ventaId: venta.ventaId,
          productoId,
          cantidad,
          precioUnitario,
          totalLinea,
          descuento: descuentoLinea,
          createdAt: venta.createdAt,
          puntoDeVentaId: venta.puntoDeVentaId,
          puntoDeVenta: venta.puntoDeVenta,
          puntoDeVentaNombre: venta.puntoDeVenta?.nombre,
          cliente: venta.cliente,
          producto: item.producto ?? venta.producto,
          productoNombre: item.producto?.nombre || venta.producto?.nombre,
          productoCodigoInterno: item.producto?.codigoInterno || venta.producto?.codigoInterno || undefined,
          costoFifo,
        })
      })
      return
    }

    if (!venta.productoId) return

    const cantidad = Number(venta.cantidad ?? 0)
    const precioUnitario = Number(
      venta.producto?.precioVenta ?? (cantidad > 0 ? Number(venta.total ?? 0) / cantidad : 0),
    )
    const totalLinea = Number(venta.producto ? cantidad * precioUnitario : venta.total ?? precioUnitario * cantidad)

    lineas.push({
      id: venta.ventaId,
      ventaId: venta.ventaId,
      productoId: venta.productoId,
      cantidad,
      precioUnitario,
      totalLinea,
      descuento: descuentoTotal,
      createdAt: venta.createdAt,
      puntoDeVentaId: venta.puntoDeVentaId,
      puntoDeVenta: venta.puntoDeVenta,
      puntoDeVentaNombre: venta.puntoDeVenta?.nombre,
      cliente: venta.cliente,
      producto: venta.producto,
      productoNombre: venta.producto?.nombre,
      productoCodigoInterno: venta.producto?.codigoInterno || undefined,
    })
  })

  return lineas
}
