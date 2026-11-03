import { Prisma } from '@/generated/prisma'
import { ActionError } from '@/lib/server-actions'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service'
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider'
import {
  emitirVentaContado,
  emitirVentaCredito
} from '@/features/contabilidad-formal/services/sale-posting-service'

export type TipoVencimientoFactura = 'fecha' | 'plazo' | 'contra_pago'

const PLAZO_VENCIMIENTO_DIAS = 30

export function normalizeTipoVencimiento(
  tipoVencimiento?: string | null
): TipoVencimientoFactura {
  const normalized = (tipoVencimiento || '').trim().toLowerCase()

  if (normalized === 'fecha') {
    return 'fecha'
  }

  if (normalized === 'credito' || normalized === 'crédito') {
    return 'fecha'
  }

  if (normalized === 'plazo' || normalized === 'plazo_30') {
    return 'plazo'
  }

  if (
    normalized === 'contra_pago' ||
    normalized === 'contra_entrega' ||
    normalized === 'contraentrega'
  ) {
    return 'contra_pago'
  }

  return 'contra_pago'
}

export function resolveFechaVencimiento(
  tipoVencimiento: TipoVencimientoFactura,
  fechaVencimiento?: string | null
): Date | null {
  if (tipoVencimiento === 'contra_pago') {
    return null
  }

  if (tipoVencimiento === 'plazo') {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + PLAZO_VENCIMIENTO_DIAS)
    return fecha
  }

  if (!fechaVencimiento) {
    throw new Error('La fecha de vencimiento es obligatoria para tipo fecha')
  }

  const parsed = new Date(fechaVencimiento)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Fecha de vencimiento inválida')
  }

  return parsed
}

export interface FacturacionCobroWorkflowParams {
  ventaId: string
  facturaId: string
  clienteId: string
  montoTotal: number
  usuarioId: string
  tenantId: string
  observaciones?: string | null
  tipoVencimiento?: string | null
  fechaVencimiento?: string | null
  cuentaBancariaId?: string | null
  /**
   * Fecha de emision de la factura; define la fecha del asiento formal para
   * que el corte de periodo use la fecha del documento y no la del proceso.
   */
  fechaEmision?: Date | null
}

interface CuentaTipoPagoResolucion {
  cuenta: {
    cuentaId: string
    moneda: string
    tipoCuenta: string
  }
  tipoPago: {
    tipoId: string
    nombre: string
  }
}

async function resolveCuentaYTipoPago(
  tx: Prisma.TransactionClient,
  cuentaBancariaId?: string | null,
  tenantId?: string
): Promise<CuentaTipoPagoResolucion> {
  let cuentaPreferida: { cuentaId: string; moneda: string; tipoCuenta: string } | null = null
  if (cuentaBancariaId) {
    cuentaPreferida = await tx.cuentaBancaria.findFirst({
      where: {
        cuentaId: cuentaBancariaId,
        isActive: true,
        tenantId
      },
      select: {
        cuentaId: true,
        moneda: true,
        tipoCuenta: true
      }
    })
  }

  const tipoPagoActivos = await tx.tipoPago.findMany({
    where: { isActive: true, tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      tipoId: true,
      nombre: true,
      cuentaDefecto: true
    }
  })

  if (tipoPagoActivos.length === 0) {
    throw new Error('No hay tipos de pago activos para registrar el cobro')
  }

  let cuentaDefecto: { cuentaId: string; moneda: string; tipoCuenta: string } | null = null
  let tipoPagoSeleccionado = tipoPagoActivos[0]

  for (const tipoPago of tipoPagoActivos) {
    if (!tipoPago.cuentaDefecto) {
      continue
    }

    const cuenta = await tx.cuentaBancaria.findFirst({
      where: {
        cuentaId: tipoPago.cuentaDefecto,
        isActive: true,
        tenantId,
      },
      select: {
        cuentaId: true,
        moneda: true,
        tipoCuenta: true
      }
    })

    if (!cuenta) {
      continue
    }

    cuentaDefecto = cuenta
    tipoPagoSeleccionado = tipoPago
    break
  }

  const cuentaFallback =
    cuentaPreferida ||
    cuentaDefecto ||
    (await tx.cuentaBancaria.findFirst({
      where: { isActive: true, tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        cuentaId: true,
        moneda: true,
        tipoCuenta: true
      }
    }))

  if (!cuentaFallback) {
    throw new Error('No hay cuentas bancarias activas para registrar el cobro')
  }

  return {
    cuenta: cuentaFallback,
    tipoPago: {
      tipoId: tipoPagoSeleccionado.tipoId,
      nombre: tipoPagoSeleccionado.nombre
    }
  }
}

export interface ReconciliacionDirectaParams {
  ventaId: string
  montoTotal: number
  usuarioId: string
  tenantId: string
  observaciones?: string | null
  cuentaBancariaId?: string | null
}

export async function reconciliarVentaDirecta(
  tx: Prisma.TransactionClient,
  params: ReconciliacionDirectaParams
): Promise<string> {
  const montoTotal = Number(params.montoTotal || 0)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new Error('El monto total de la venta debe ser mayor que cero')
  }

  const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId, params.tenantId)
  
  // Para ventas directas sin factura, usamos una referencia genérica
  const referenciaCobro = `AUTO-${params.ventaId.slice(-8)}`

  const fechaReconciliacion = new Date()
  const conversion = buildPersistedAccountingAmount(
    montoTotal,
    cuenta.moneda,
    undefined,
    fechaReconciliacion
  )

  const reconciliacion = await tx.reconciliacionVenta.create({
    data: {
      tenantId: params.tenantId,
      ventaId: params.ventaId,
      cuentaId: cuenta.cuentaId,
      tipoPagoId: tipoPago.tipoId,
      monto: montoTotal,
      moneda: cuenta.moneda,
      ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
      ...(conversion.montoConvertido != null
        ? { montoConvertido: conversion.montoConvertido }
        : {}),
      fechaReconciliacion,
      ...(conversion.fxEvidence ?? {}),
      verificacionTransferenciaId: referenciaCobro,
      idTransferencia: referenciaCobro,
      observaciones: params.observaciones || `Venta directa al contado`,
      reconciliadoPor: params.usuarioId
    }
  })

  await tx.cuentaBancaria.update({
    where: { cuentaId: cuenta.cuentaId },
    data: {
      saldo: {
        increment: montoTotal
      }
    }
  })

  return reconciliacion.reconciliacionId
}

export async function applyFacturacionCobroWorkflow(
  tx: Prisma.TransactionClient,
  params: FacturacionCobroWorkflowParams
): Promise<{ tipoVencimiento: TipoVencimientoFactura; reconciliacionId: string | null }> {
  const montoTotal = Number(params.montoTotal || 0)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new Error('El monto total de la factura debe ser mayor que cero')
  }

  const tipoVencimiento = params.tipoVencimiento
    ? normalizeTipoVencimiento(params.tipoVencimiento)
    : (params.fechaVencimiento ? 'fecha' : 'contra_pago')
  
  const fechaVencimiento = resolveFechaVencimiento(
    tipoVencimiento,
    params.fechaVencimiento
  )

  if (tipoVencimiento === 'contra_pago') {
    const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId, params.tenantId)
    const referenciaCobro = `AUTO-${params.facturaId.slice(-8)}`

    const fechaReconciliacion = new Date()
    const politica = await tx.tenantAccountingPolicy.findUnique({
      where: { tenantId: params.tenantId },
      select: { functionalCurrencyCode: true }
    })
    const monedaFuncional = politica?.functionalCurrencyCode?.trim().toUpperCase() || 'CUP'
    const monedaCobro = cuenta.moneda.trim().toUpperCase()
    let tasaCambio: number | undefined
    let fechaVigenciaTasa: Date | undefined
    let tasaId: string | undefined

    if (monedaCobro !== monedaFuncional) {
      const tasa = await exchangeRateProvider.getRateAsOf({
        sourceCurrency: monedaCobro,
        targetCurrency: monedaFuncional,
        boundaryAt: fechaReconciliacion,
        client: tx
      })
      if (!tasa) {
        throw new ActionError(
          `No hay tasa de cambio publicada para ${monedaCobro} → ${monedaFuncional}; no se puede registrar el cobro`,
          'VALIDATION_ERROR'
        )
      }
      tasaCambio = tasa.tasa
      fechaVigenciaTasa = tasa.fechaVigencia
      tasaId = tasa.tasaId
    }

    const conversion = buildPersistedAccountingAmount(
      montoTotal,
      monedaCobro,
      tasaCambio,
      fechaVigenciaTasa,
      tasaId,
      monedaFuncional
    )

    const reconciliacion = await tx.reconciliacionVenta.create({
      data: {
        tenantId: params.tenantId,
        ventaId: params.ventaId,
        cuentaId: cuenta.cuentaId,
        tipoPagoId: tipoPago.tipoId,
        monto: montoTotal,
        moneda: monedaCobro,
        ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
        ...(conversion.montoConvertido != null
          ? { montoConvertido: conversion.montoConvertido }
          : {}),
        fechaReconciliacion,
        ...(conversion.fxEvidence ?? {}),
        functionalCurrency: monedaFuncional,
        verificacionTransferenciaId: referenciaCobro,
        idTransferencia: referenciaCobro,
        observaciones: params.observaciones || `Cobro total por contra pago`,
        reconciliadoPor: params.usuarioId
      }
    })

    await tx.cuentaBancaria.update({
      where: { cuentaId: cuenta.cuentaId },
      data: {
        saldo: {
          increment: montoTotal
        }
      }
    })

    await tx.factura.update({
      where: { idFactura: params.facturaId },
      data: {
        estado: 'PAGADA',
        fechaVencimiento: null
      }
    })

    // Capa de contabilidad formal: la venta cobrada al contado no deja cuenta
    // por cobrar (el cobro ocurre en el mismo instante), asi que el asiento
    // debita la tesoreria y acredita el ingreso por ventas. El cobro de una
    // venta a plazo es otro evento (`COBRO_CXC`), que liquida la cuenta por
    // cobrar abierta por `VENTA_CREDITO`.
    await emitirVentaContado(
      tx,
      { tenantId: params.tenantId, userId: params.usuarioId },
      {
        reconciliacionId: reconciliacion.reconciliacionId,
        fecha: reconciliacion.fechaReconciliacion,
        monto: reconciliacion.monto,
        moneda: reconciliacion.moneda,
        montoFuncional: reconciliacion.montoConvertido,
        monedaFuncional: reconciliacion.functionalCurrency,
        tasaCambio: reconciliacion.tasaCambio,
        fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
        treasuryAccountType: cuenta.tipoCuenta,
        referencia: referenciaCobro,
        descripcion: params.observaciones || 'Cobro total por contra pago'
      }
    )

    return {
      tipoVencimiento,
      reconciliacionId: reconciliacion.reconciliacionId
    }
  }

  await tx.cuentaPorCobrar.upsert({
    where: { facturaId: params.facturaId },
    update: {
      clienteId: params.clienteId,
      montoDeuda: montoTotal,
      montoPagado: 0,
      estado: 'PENDIENTE',
      fechaVencimiento,
      idTransferencia: null
    },
    create: {
      tenantId: params.tenantId,
      facturaId: params.facturaId,
      clienteId: params.clienteId,
      montoDeuda: montoTotal,
      montoPagado: 0,
      estado: 'PENDIENTE',
      fechaVencimiento
    }
  })

  await tx.factura.update({
    where: { idFactura: params.facturaId },
    data: {
      estado: 'PENDIENTE',
      fechaVencimiento
    }
  })

  // Capa de contabilidad formal: la venta a plazo abre la cuenta por cobrar con
  // la que quedo registrada la factura. El cobro posterior la liquida con
  // `COBRO_CXC`, de modo que el ingreso se reconoce una sola vez.
  await emitirVentaCredito(
    tx,
    { tenantId: params.tenantId, userId: params.usuarioId },
    {
      facturaId: params.facturaId,
      fecha: params.fechaEmision ?? new Date(),
      monto: montoTotal,
      descripcion: `Venta a credito ${params.facturaId}`
    }
  )

  return { tipoVencimiento, reconciliacionId: null }
}
