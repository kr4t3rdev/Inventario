import { ActionError } from '@/lib/server-actions'
import type { Prisma } from '@/generated/prisma'

export interface LineaFacturaRecepcion {
  productoId: string
  cantidad: number
  precioUnitario: number
}

export interface ReconciliarCostosRecepcionInput {
  tenantId: string
  ordenId: string
  items: LineaFacturaRecepcion[]
}

/**
 * @description Aplica costos facturados a recepciones de una OC en orden FIFO.
 * Las unidades aún no facturadas conservan el costo estimado de la orden.
 * @param {Prisma.TransactionClient} tx - Cliente de la transacción de factura.
 * @param {ReconciliarCostosRecepcionInput} input - OC, tenant y líneas facturadas.
 * @returns {Promise<void>} Promesa resuelta cuando queda reconciliado el costo.
 */
export async function reconciliarCostosRecepcionConFactura(
  tx: Prisma.TransactionClient,
  input: ReconciliarCostosRecepcionInput,
): Promise<void> {
  for (const item of input.items) {
    if (
      !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
      !Number.isSafeInteger(item.precioUnitario) || item.precioUnitario < 0
    ) {
      throw new ActionError('La línea de factura no tiene cantidad o costo válidos', 'VALIDATION_ERROR')
    }
  }

  const recepciones = await tx.recepcionItem.findMany({
    where: { tenantId: input.tenantId, ordenItem: { ordenId: input.ordenId } },
    orderBy: [{ recepcion: { fecha: 'asc' } }, { id: 'asc' }],
    select: {
      id: true,
      productoId: true,
      ordenItemId: true,
      cantidad: true,
      cantidadFacturada: true,
      montoFacturado: true,
      ordenItem: {
        select: {
          precioUnitario: true,
        },
      },
    },
  })
  if (recepciones.length === 0) {
    throw new ActionError('No hay líneas de recepción disponibles para conciliar', 'FACTURA_EXCEDE_RECEPCION')
  }

  const recepcionesPorProducto = new Map<string, typeof recepciones>()
  for (const recepcion of recepciones) {
    const items = recepcionesPorProducto.get(recepcion.productoId) ?? []
    items.push(recepcion)
    recepcionesPorProducto.set(recepcion.productoId, items)
  }

  const pendientes = new Map(recepciones.map((recepcion) => [recepcion.id, {
    cantidadFacturada: recepcion.cantidadFacturada,
    montoFacturado: recepcion.montoFacturado,
  }]))
  const planes: Array<{ id: string; cantidadFacturada: number; montoFacturado: number }> = []

  for (const item of input.items) {
    let restante = item.cantidad

    for (const recepcion of recepcionesPorProducto.get(item.productoId) ?? []) {
      if (restante === 0) break
      const pendiente = pendientes.get(recepcion.id)
      if (!pendiente) continue
      const disponible = recepcion.cantidad - pendiente.cantidadFacturada
      if (disponible <= 0) continue

      const facturar = Math.min(restante, disponible)
      pendiente.cantidadFacturada += facturar
      pendiente.montoFacturado += facturar * item.precioUnitario
      restante -= facturar
      planes.push({ id: recepcion.id, ...pendiente })
    }

    if (restante > 0) {
      throw new ActionError(
        `La factura excede la cantidad recibida para ${item.productoId}`,
        'FACTURA_EXCEDE_RECEPCION',
      )
    }
  }

  const planesPorRecepcion = new Map<string, { cantidadFacturada: number; montoFacturado: number }>()
  for (const plan of planes) {
    planesPorRecepcion.set(plan.id, {
      cantidadFacturada: plan.cantidadFacturada,
      montoFacturado: plan.montoFacturado,
    })
  }
  for (const [id, data] of planesPorRecepcion) {
    await tx.recepcionItem.update({ where: { id }, data })
  }

  for (const recepcion of recepciones) {
    const estado = planesPorRecepcion.get(recepcion.id)
    if (!estado) continue
    const costoUnitario = Math.round((
      estado.montoFacturado +
      (recepcion.cantidad - estado.cantidadFacturada) * recepcion.ordenItem.precioUnitario
    ) / recepcion.cantidad)
    await tx.purchaseAllocation.updateMany({
      where: { tenantId: input.tenantId, recepcionItemId: recepcion.id },
      data: { costoUnitarioSnapshot: costoUnitario },
    })
  }
}
