type TipoUbicacion = 'almacen' | 'punto_venta'

type UpsertStockOpts =
  | {
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'increment'
      delta: number
    }
  | {
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'set'
      valor: number
    }

/**
 * @description Hace upsert del stock materializado por ubicación dentro de una transacción Prisma.
 * Usar modo 'increment' para compras, transferencias y ventas (delta puede ser negativo para decrementar).
 * Usar modo 'set' para restock (que ya calcula el valor absoluto nuevo).
 * @param {any} tx - Cliente de transacción Prisma (o prisma directo)
 * @param {UpsertStockOpts} opts - Opciones de actualización
 * @returns {Promise<void>}
 */
export async function upsertStockUbicacion(
  tx: any,
  opts: UpsertStockOpts
): Promise<void> {
  const { productoId, tipoUbicacion, ubicacionId } = opts

  if (opts.modo === 'increment') {
    const { delta } = opts
    await tx.stockUbicacion.upsert({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId,
          tipoUbicacion,
          ubicacionId,
        },
      },
      update: {
        cantidad: { increment: delta },
        cantidadDisponible: { increment: delta },
      },
      create: {
        productoId,
        tipoUbicacion,
        ubicacionId,
        cantidad: delta,
        cantidadReservada: 0,
        cantidadDisponible: delta,
      },
    })
  } else {
    const { valor } = opts
    await tx.stockUbicacion.upsert({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId,
          tipoUbicacion,
          ubicacionId,
        },
      },
      update: {
        cantidad: valor,
        cantidadDisponible: valor,
      },
      create: {
        productoId,
        tipoUbicacion,
        ubicacionId,
        cantidad: valor,
        cantidadReservada: 0,
        cantidadDisponible: valor,
      },
    })
  }
}
