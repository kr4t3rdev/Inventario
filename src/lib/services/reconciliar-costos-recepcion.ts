import { ActionError } from '@/lib/server-actions'
import type { Prisma } from '@/generated/prisma'
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence'

export interface LineaFacturaRecepcion {
  compraDocumentoItemId: string
  productoId: string
  cantidad: number
  precioUnitario: number
}

export interface ReconciliarCostosRecepcionInput {
  tenantId: string
  ordenId: string
  fechaFactura: Date
  moneda: string
  tasaCambio?: number | null
  items: LineaFacturaRecepcion[]
}

const PROVENANCE_SOURCE = 'purchase-receipt-invoice-allocation'

interface RecalcularAgregadosFacturadosInput {
  tenantId: string
  ordenId: string
}

interface AgregadoRecepcionFacturada {
  cantidadFacturada: number
  montoFacturado: number
}

/**
 * @description Serializes invoice allocation mutations for one purchase order.
 * @param {Prisma.TransactionClient} tx - Transaction holding the order-row lock.
 * @param {string} tenantId - Tenant that owns the order.
 * @param {string} ordenId - Purchase order whose receipt counters will change.
 * @returns {Promise<void>} Resolves after the order row has been acquired.
 */
async function lockOrdenCompraParaFacturacion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
): Promise<void> {
  const lock = await tx.ordenCompra.updateMany({
    where: { tenantId, id: ordenId },
    data: { updatedAt: new Date() },
  })
  if (lock.count !== 1) {
    throw new ActionError('La orden de compra ya no está disponible', 'ORDEN_COMPRA_NO_ENCONTRADA')
  }
}

/**
 * @description Rebuilds invoice counters from active purchase lines in receipt FIFO order.
 * @param {Prisma.TransactionClient} tx - Transaction that already changed invoice state.
 * @param {RecalcularAgregadosFacturadosInput} input - Tenant and purchase order.
 * @returns {Promise<void>} Resolves after compare-and-set updates for all receipts.
 */
export async function recalcularAgregadosFacturadosDeOrden(
  tx: Prisma.TransactionClient,
  input: RecalcularAgregadosFacturadosInput,
): Promise<void> {
  await lockOrdenCompraParaFacturacion(tx, input.tenantId, input.ordenId)
  const [recepciones, lineasActivas] = await Promise.all([
    tx.recepcionItem.findMany({
      where: { tenantId: input.tenantId, ordenItem: { ordenId: input.ordenId } },
      orderBy: [{ recepcion: { fecha: 'asc' } }, { id: 'asc' }],
      select: {
        id: true,
        productoId: true,
        cantidad: true,
        cantidadFacturada: true,
        montoFacturado: true,
      },
    }),
    tx.compraDocumentoItem.findMany({
      where: {
        tenantId: input.tenantId,
        compraDocumento: {
          tenantId: input.tenantId,
          ordenCompraId: input.ordenId,
          estado: { not: 'ANULADA' },
          deletedAt: null,
        },
      },
      orderBy: [
        { compraDocumento: { createdAt: 'asc' } },
        { compraDocumentoItemId: 'asc' },
      ],
      select: {
        compraDocumentoItemId: true,
        productoId: true,
        cantidad: true,
        precioUnitario: true,
        receiptInvoiceAllocations: {
          select: { recepcionItemId: true, cantidad: true },
        },
      },
    }),
  ])

  const recepcionesPorProducto = new Map<string, typeof recepciones>()
  const recepcionesPorId = new Map<string, (typeof recepciones)[number]>()
  const objetivos = new Map<string, AgregadoRecepcionFacturada>()
  for (const recepcion of recepciones) {
    const grupo = recepcionesPorProducto.get(recepcion.productoId) ?? []
    grupo.push(recepcion)
    recepcionesPorProducto.set(recepcion.productoId, grupo)
    recepcionesPorId.set(recepcion.id, recepcion)
    objetivos.set(recepcion.id, { cantidadFacturada: 0, montoFacturado: 0 })
  }

  // La procedencia persistida es la fuente de verdad: la asignación se resolvió
  // por FIFO cuando se emitió la factura y no debe re-planificarse. Anular una
  // factura libera unidades y desplazaría un plan recalculado desde cero, que
  // es lo que hacía inválida la anulación de cualquier factura que no fuese la
  // última de su orden.
  const lineasSinProcedencia: typeof lineasActivas = []
  for (const linea of lineasActivas) {
    if (
      !Number.isSafeInteger(linea.cantidad) || linea.cantidad <= 0 ||
      !Number.isSafeInteger(linea.precioUnitario) || linea.precioUnitario < 0
    ) {
      throw new ActionError('Una factura activa contiene cantidades o costos inválidos', 'FACTURA_ORIGEN_NO_VERIFICABLE')
    }

    const persistidas = linea.receiptInvoiceAllocations
    if (persistidas.length === 0) {
      lineasSinProcedencia.push(linea)
      continue
    }

    const cantidadPersistida = persistidas.reduce((total, item) => total + item.cantidad, 0)
    if (cantidadPersistida !== linea.cantidad) {
      throw new ActionError('La procedencia persistida no cubre la cantidad facturada', 'FACTURA_PROVENIENCIA_INCONSISTENTE')
    }
    for (const asignacion of persistidas) {
      if (!Number.isSafeInteger(asignacion.cantidad) || asignacion.cantidad <= 0) {
        throw new ActionError('La procedencia persistida contiene cantidades inválidas', 'FACTURA_PROVENIENCIA_INCONSISTENTE')
      }
      const recepcion = recepcionesPorId.get(asignacion.recepcionItemId)
      const objetivo = objetivos.get(asignacion.recepcionItemId)
      if (!recepcion || !objetivo || recepcion.productoId !== linea.productoId) {
        throw new ActionError('La procedencia persistida no pertenece a esta orden', 'FACTURA_PROVENIENCIA_INCONSISTENTE')
      }
      const monto = asignacion.cantidad * linea.precioUnitario
      if (!Number.isSafeInteger(monto) || !Number.isSafeInteger(objetivo.montoFacturado + monto)) {
        throw new ActionError('El agregado facturado excede la precisión permitida', 'FACTURA_ORIGEN_NO_VERIFICABLE')
      }
      objetivo.cantidadFacturada += asignacion.cantidad
      objetivo.montoFacturado += monto
    }
  }

  for (const recepcion of recepciones) {
    const objetivo = objetivos.get(recepcion.id)
    if (!objetivo) continue
    if (objetivo.cantidadFacturada > recepcion.cantidad) {
      throw new ActionError('Las facturas activas exceden las cantidades recibidas', 'FACTURA_EXCEDE_RECEPCION')
    }
  }

  // Las líneas sin procedencia persistida (facturas emitidas antes de existir la
  // capa de procedencia) se planifican por FIFO sobre la capacidad que queda
  // libre, en el mismo orden estable con el que se emitieron.
  for (const linea of lineasSinProcedencia) {
    let restante = linea.cantidad
    for (const recepcion of recepcionesPorProducto.get(linea.productoId) ?? []) {
      if (restante === 0) break
      const objetivo = objetivos.get(recepcion.id)
      if (!objetivo) continue
      const disponible = recepcion.cantidad - objetivo.cantidadFacturada
      if (disponible <= 0) continue
      const asignada = Math.min(restante, disponible)
      const monto = asignada * linea.precioUnitario
      if (!Number.isSafeInteger(monto) || !Number.isSafeInteger(objetivo.montoFacturado + monto)) {
        throw new ActionError('El agregado facturado excede la precisión permitida', 'FACTURA_ORIGEN_NO_VERIFICABLE')
      }
      objetivo.cantidadFacturada += asignada
      objetivo.montoFacturado += monto
      restante -= asignada
    }
    if (restante > 0) {
      throw new ActionError('Las facturas activas exceden las cantidades recibidas', 'FACTURA_EXCEDE_RECEPCION')
    }
  }

  for (const recepcion of recepciones) {
    const objetivo = objetivos.get(recepcion.id)
    if (!objetivo) continue
    const actualizacion = await tx.recepcionItem.updateMany({
      where: {
        id: recepcion.id,
        tenantId: input.tenantId,
        cantidadFacturada: recepcion.cantidadFacturada,
        montoFacturado: recepcion.montoFacturado,
      },
      data: objetivo,
    })
    if (actualizacion.count !== 1) {
      throw new ActionError('La recepción cambió durante la anulación de la factura', 'FACTURA_RECEPCION_CONCURRENTE')
    }
  }
}

function roundFunctionalAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

/**
 * @description Persists invoice-line provenance against oldest received units,
 * capturing only the exchange rate applied to this invoice.
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
      !item.compraDocumentoItemId ||
      !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
      !Number.isSafeInteger(item.precioUnitario) || item.precioUnitario < 0
    ) {
      throw new ActionError('La línea de factura no tiene cantidad o costo válidos', 'VALIDATION_ERROR')
    }
  }
  if (!Number.isFinite(input.fechaFactura.getTime()) || !input.moneda.trim()) {
    throw new ActionError('La factura no tiene fecha o moneda válidas', 'VALIDATION_ERROR')
  }
  const monedaOrigen = input.moneda.trim().toUpperCase()
  const policy = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId: input.tenantId },
    select: { functionalCurrencyCode: true },
  })
  const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase()
  const tasa = input.tasaCambio == null ? null : Number(input.tasaCambio)
  const fxAplicable = Boolean(monedaFuncional && (monedaOrigen === monedaFuncional ||
    (tasa && Number.isFinite(tasa) && tasa > 0)))
  const idsFactura = input.items.map((item) => item.compraDocumentoItemId)
  if (new Set(idsFactura).size !== idsFactura.length) {
    throw new ActionError('La factura contiene líneas de procedencia duplicadas', 'VALIDATION_ERROR')
  }
  await lockOrdenCompraParaFacturacion(tx, input.tenantId, input.ordenId)
  const lineasFactura = await tx.compraDocumentoItem.findMany({
    where: {
      tenantId: input.tenantId,
      compraDocumentoItemId: { in: idsFactura },
      compraDocumento: { tenantId: input.tenantId, ordenCompraId: input.ordenId },
    },
    select: { compraDocumentoItemId: true, productoId: true, cantidad: true, precioUnitario: true },
  })
  const lineasPorId = new Map(lineasFactura.map((linea) => [linea.compraDocumentoItemId, linea]))
  if (lineasFactura.length !== input.items.length || input.items.some((item) => {
    const linea = lineasPorId.get(item.compraDocumentoItemId)
    return !linea || linea.productoId !== item.productoId || linea.cantidad !== item.cantidad ||
      linea.precioUnitario !== item.precioUnitario
  })) {
    throw new ActionError('La línea de factura no pertenece a esta recepción', 'FACTURA_EXCEDE_RECEPCION')
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
  const planesPorRecepcion = new Map<string, { cantidadFacturada: number; montoFacturado: number }>()
  const asignaciones: Prisma.PurchaseReceiptInvoiceAllocationCreateManyInput[] = []

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
      planesPorRecepcion.set(recepcion.id, { ...pendiente })
      const costoFuente = item.precioUnitario * facturar
      const montoFuncional = fxAplicable
        ? roundFunctionalAmount(monedaOrigen === monedaFuncional
          ? costoFuente
          : costoFuente * (tasa as number))
        : null
      const evidencia = costoFuente > 0 && fxAplicable && monedaFuncional ? buildAppliedFxEvidence({
        originalAmount: costoFuente,
        originalCurrency: monedaOrigen,
        functionalCurrency: monedaFuncional,
        exchangeRate: tasa ?? 1,
        convertedAmount: montoFuncional,
        rateEffectiveAt: monedaOrigen === monedaFuncional ? null : input.fechaFactura,
        fxCatalogRateId: null,
        source: PROVENANCE_SOURCE,
      }) : null
      asignaciones.push({
        tenantId: input.tenantId,
        compraDocumentoItemId: item.compraDocumentoItemId,
        recepcionItemId: recepcion.id,
        cantidad: facturar,
        costoUnitarioSnapshot: item.precioUnitario,
        fifoMonedaOrigen: monedaOrigen,
        fifoFechaFuente: input.fechaFactura,
        fifoMonedaFuncional: evidencia ? monedaFuncional : null,
        fifoCostoFuncional: evidencia ? montoFuncional : null,
        fifoTasaCambio: evidencia && monedaOrigen !== monedaFuncional ? tasa : null,
        fifoFechaTasa: evidencia && monedaOrigen !== monedaFuncional ? input.fechaFactura : null,
        fifoEvidenciaFx: evidencia ? JSON.stringify({
          ...evidencia,
          rawConvertedAmount: montoFuncional,
          rawExchangeRate: monedaOrigen === monedaFuncional ? null : tasa,
        }) : null,
      })
    }

    if (restante > 0) {
      throw new ActionError(
        `La factura excede la cantidad recibida para ${item.productoId}`,
        'FACTURA_EXCEDE_RECEPCION',
      )
    }
  }

  for (const [id, data] of planesPorRecepcion) {
    const anterior = recepciones.find((recepcion) => recepcion.id === id)
    if (!anterior) throw new ActionError('La recepción cambió durante la conciliación', 'FACTURA_RECEPCION_CONCURRENTE')
    const result = await tx.recepcionItem.updateMany({
      where: {
        id,
        tenantId: input.tenantId,
        cantidadFacturada: anterior.cantidadFacturada,
        montoFacturado: anterior.montoFacturado,
      },
      data,
    })
    if (result.count !== 1) {
      throw new ActionError('La recepción cambió durante la conciliación', 'FACTURA_RECEPCION_CONCURRENTE')
    }
  }
  if (asignaciones.length) await tx.purchaseReceiptInvoiceAllocation.createMany({ data: asignaciones })
}
