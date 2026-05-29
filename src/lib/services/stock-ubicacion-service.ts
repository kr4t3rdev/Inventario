type TipoUbicacion = 'almacen' | 'punto_venta'

type UpsertStockOpts =
  | {
      tenantId?: string
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'increment'
      delta: number
      /** Stock reservado (pedidos pendientes, etc.). Si se omite, preserva el valor existente. */
      cantidadReservada?: number
    }
  | {
      tenantId?: string
      productoId: string
      tipoUbicacion: TipoUbicacion
      ubicacionId: string
      modo: 'set'
      valor: number
      /** Stock reservado (pedidos pendientes, etc.). Si se omite, preserva el valor existente. */
      cantidadReservada?: number
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
  const { tenantId: explicitTenantId, productoId, tipoUbicacion, ubicacionId } = opts

  // tenantId es requerido por Prisma para el create del upsert.
  // Si no se pasa, se obtiene del producto (backward-compatible).
  const tenantId = explicitTenantId ?? (
    await tx.producto.findUniqueOrThrow({
      where: { id: productoId },
      select: { tenantId: true },
    })
  ).tenantId

  if (opts.modo === 'increment') {
    const { delta, cantidadReservada } = opts

    if (cantidadReservada !== undefined) {
      // Si se provee cantidadReservada, leer registro existente para calcular disponible
      const existing = await tx.stockUbicacion.findUnique({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId, tipoUbicacion, ubicacionId,
          },
        },
        select: { cantidad: true },
      })

      await tx.stockUbicacion.upsert({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId, tipoUbicacion, ubicacionId,
          },
        },
        update: {
          cantidad: { increment: delta },
          cantidadReservada,
          cantidadDisponible: (existing ? existing.cantidad + delta : delta) - cantidadReservada,
        },
        create: {
          tenantId, productoId, tipoUbicacion, ubicacionId,
          cantidad: delta,
          cantidadReservada,
          cantidadDisponible: delta - cantidadReservada,
        },
      })
    } else {
      // Sin cantidadReservada: comportamiento legacy, disponible = cantidad
      await tx.stockUbicacion.upsert({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId, tipoUbicacion, ubicacionId,
          },
        },
        update: {
          cantidad: { increment: delta },
          cantidadDisponible: { increment: delta },
        },
        create: {
          tenantId, productoId, tipoUbicacion, ubicacionId,
          cantidad: delta,
          cantidadReservada: 0,
          cantidadDisponible: delta,
        },
      })
    }
  } else {
    const { valor, cantidadReservada } = opts
    const reservada = cantidadReservada ?? 0

    await tx.stockUbicacion.upsert({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId, tipoUbicacion, ubicacionId,
        },
      },
      update: {
        cantidad: valor,
        cantidadReservada: reservada,
        cantidadDisponible: valor - reservada,
      },
      create: {
        tenantId, productoId, tipoUbicacion, ubicacionId,
        cantidad: valor,
        cantidadReservada: reservada,
        cantidadDisponible: valor - reservada,
      },
    })
  }
}
