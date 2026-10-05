import { Prisma } from '@/generated/prisma'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service'
import { ActionError } from '@/lib/server-actions'
import {
  getRequiredTenantAccountingPolicy,
  TenantAccountingPolicyError,
} from '@/features/contabilidad/services/tenant-accounting-policy-service'
import {
  buildAppliedFxEvidenceExact,
  type ExactAppliedFxEvidence,
} from '@/features/contabilidad/domain/fx-evidence'
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine'
import { resolveAccountingAccountMovement } from '@/features/contabilidad/services/accounting-account-movement-valuation'
import {
  buildEventoVentaContado,
  buildEventoVentaCredito,
} from '@/features/contabilidad-formal/lib/event-builders'

export type TipoVencimientoFactura = 'fecha' | 'plazo' | 'contra_pago'

const PLAZO_VENCIMIENTO_DIAS = 30
const FUENTE_FX_CXC_VENTA = 'facturacion-venta-credito-cxc'

/**
 * @description Normaliza el modo operativo con la misma semántica del motor
 * formal: valores desconocidos conservan el flujo legacy (`off`).
 * @returns {'off'|'shadow'|'enforce'} Modo formal efectivo.
 */
function modoFormalActual(): 'off' | 'shadow' | 'enforce' {
  const modo = process.env.CONTABILIDAD_FORMAL_MODE
  return modo === 'shadow' || modo === 'enforce' ? modo : 'off'
}

/**
 * @description Identifica errores de valoración que shadow puede reportar al
 * motor sin bloquear la operación de caja.
 * @param {unknown} error - Error capturado durante la resolución FX.
 * @returns {boolean} `true` únicamente para errores de valoración de dominio.
 */
function esErrorValoracionFormal(error: unknown): error is ActionError {
  return error instanceof ActionError && error.code === 'FX_INSUFICIENTE'
}

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
  monedaOriginal?: string | null
  valoracion?: ExactAppliedFxEvidence | null
  /**
   * Porción cobrada HOY (efectivo+tarjeta+transferencia) en un pago MIXTO con
   * vencimiento fecha/plazo. Se concilia y abona al banco en la misma tx, y la
   * CxC queda sólo por el remanente (deuda realmente pendiente). Se clampa a
   * [0, montoTotal]; sin valor (o 0) el comportamiento es el clásico: CxC por
   * el total.
   */
  montoCobradoContado?: number | null
}

interface CuentaTipoPagoResolucion {
  cuenta: {
    cuentaId: string
    moneda: string
    tipoCuenta: string | null
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
  let cuentaPreferida: { cuentaId: string; moneda: string; tipoCuenta: string | null } | null = null
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

  let cuentaDefecto: { cuentaId: string; moneda: string; tipoCuenta: string | null } | null = null
  let tipoPagoSeleccionado = tipoPagoActivos[0]

  for (const tipoPago of tipoPagoActivos) {
    if (!tipoPago.cuentaDefecto) {
      continue
    }

    const cuenta = await tx.cuentaBancaria.findFirst({
      where: {
        cuentaId: tipoPago.cuentaDefecto,
        isActive: true,
        tenantId
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

/**
 * @description Resuelve la moneda funcional configurada para el tenant sin aplicar
 * valores por defecto; la ausencia de política impide valorar la cuenta por cobrar.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional activo.
 * @param {string} tenantId - Tenant propietario de la política contable.
 * @returns {Promise<string>} Código de moneda funcional normalizado.
 */
async function requireMonedaFuncionalVenta(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  try {
    const policy = await getRequiredTenantAccountingPolicy(tenantId, tx)
    const currency = policy.functionalCurrencyCode?.trim().toUpperCase()
    if (!currency) {
      throw new ActionError(
        'El tenant no tiene moneda funcional configurada para valorar la cuenta por cobrar',
        'FX_INSUFICIENTE'
      )
    }
    return currency
  } catch (error) {
    if (error instanceof TenantAccountingPolicyError) {
      throw new ActionError(
        'El tenant no tiene moneda funcional configurada para valorar la cuenta por cobrar',
        'FX_INSUFICIENTE'
      )
    }
    throw error
  }
}

/**
 * @description Resuelve la valoración autoritativa de una venta a crédito sin
 * consultar tesorería. Sin valoración explícita, el dominio actual solo permite
 * usar la moneda funcional; una moneda distinta debe traer tasa y evidencia
 * canónicas desde el caller.
 * @param {object} params - Importe, política funcional y valoración opcional.
 * @param {number} params.amount - Importe de la factura.
 * @param {string} params.functionalCurrency - Moneda funcional del tenant.
 * @param {string | null | undefined} params.originalCurrency - Moneda explícita.
 * @param {ExactAppliedFxEvidence | null | undefined} params.valoracion - Evidencia del caller.
 * @returns {ExactAppliedFxEvidence} Valoración validada con Decimal y evidencia v2.
 */
function resolverValoracionVentaCredito(params: {
  amount: number | Prisma.Decimal
  functionalCurrency: string
  originalCurrency?: string | null
  valoracion?: ExactAppliedFxEvidence | null
}): ExactAppliedFxEvidence {
  const functionalCurrency = params.functionalCurrency.trim().toUpperCase()
  const originalCurrency = params.originalCurrency == null
    ? null
    : params.originalCurrency.trim().toUpperCase()
  const montoOriginal = new Prisma.Decimal(params.amount)

  if (
    !functionalCurrency ||
    !montoOriginal.isFinite() ||
    !montoOriginal.gt(0) ||
    !montoOriginal.mul(10000).isInteger()
  ) {
    throw new ActionError(
      'El monto de la factura no es representable en la moneda original',
      'FX_INSUFICIENTE'
    )
  }

  if (params.originalCurrency != null && !originalCurrency) {
    throw new ActionError(
      'La moneda original explícita no es válida',
      'FX_INSUFICIENTE'
    )
  }

  const valoracion = params.valoracion
  if (!valoracion) {
    if (originalCurrency && originalCurrency !== functionalCurrency) {
      throw new ActionError(
        'Una moneda extranjera requiere valoración FX explícita y verificable',
        'FX_INSUFICIENTE'
      )
    }

    try {
      return buildAppliedFxEvidenceExact({
        originalAmount: montoOriginal,
        originalCurrency: originalCurrency ?? functionalCurrency,
        functionalCurrency,
        source: FUENTE_FX_CXC_VENTA,
      })
    } catch (error) {
      throw new ActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible valorar la cuenta por cobrar',
        'FX_INSUFICIENTE'
      )
    }
  }

  const evidencia = valoracion.evidence
  const valoracionOriginal = evidencia.originalCurrency.trim().toUpperCase()
  const valoracionFuncional = evidencia.functionalCurrency.trim().toUpperCase()

  if (
    !valoracionOriginal ||
    !valoracionFuncional ||
    (originalCurrency && valoracionOriginal !== originalCurrency) ||
    valoracionFuncional !== functionalCurrency
  ) {
    throw new ActionError(
      'La valoración explícita no coincide con la moneda de la venta o del tenant',
      'FX_INSUFICIENTE'
    )
  }

  if (!originalCurrency && valoracionOriginal !== functionalCurrency) {
    throw new ActionError(
      'La valoración extranjera requiere moneda original explícita',
      'FX_INSUFICIENTE'
    )
  }

  let montoValoracion: Prisma.Decimal
  try {
    montoValoracion = new Prisma.Decimal(evidencia.originalAmount)
  } catch {
    throw new ActionError(
      'La valoración explícita no tiene un importe original válido',
      'FX_INSUFICIENTE'
    )
  }
  if (!montoValoracion.eq(montoOriginal)) {
    throw new ActionError(
      'La valoración explícita no coincide con el total de la factura',
      'FX_INSUFICIENTE'
    )
  }

  if (
    evidencia.fxEvidenceVersion !== 2 ||
    evidencia.fxProvenanceSource !== FUENTE_FX_CXC_VENTA ||
    (valoracionOriginal !== functionalCurrency && evidencia.fxProvenanceKind !== 'CATALOG_RATE')
  ) {
    throw new ActionError(
      'La valoración explícita no tiene procedencia FX admisible',
      'FX_INSUFICIENTE'
    )
  }

  if (
    !valoracion.tasaCambio.mul('10000000000').isInteger() ||
    !valoracion.tasaCambio.lt('10000000000')
  ) {
    throw new ActionError(
      'La tasa de cambio excede la precisión que puede conservar la cuenta por cobrar',
      'FX_INSUFICIENTE'
    )
  }

  let canonical: ExactAppliedFxEvidence
  try {
    canonical = buildAppliedFxEvidenceExact({
      originalAmount: evidencia.originalAmount,
      originalCurrency: valoracionOriginal,
      functionalCurrency,
      exchangeRate: valoracion.tasaCambio,
      convertedAmount: valoracion.montoConvertido,
      rateEffectiveAt: valoracion.rateEffectiveAt,
      source: evidencia.fxProvenanceSource,
      fxCatalogRateId: evidencia.fxCatalogRateId,
      fxProvenanceKind: valoracionOriginal === functionalCurrency
        ? undefined
        : 'CATALOG_RATE',
    })
  } catch (error) {
    throw new ActionError(
      error instanceof Error
        ? error.message
        : 'La valoración explícita no es verificable',
      'FX_INSUFICIENTE'
    )
  }

  if (
    canonical.evidence.fxEvidenceFingerprint !== evidencia.fxEvidenceFingerprint ||
    canonical.evidence.fxEvidenceVersion !== evidencia.fxEvidenceVersion ||
    canonical.evidence.fxProvenanceKind !== evidencia.fxProvenanceKind
  ) {
    throw new ActionError(
      'La evidencia FX explícita no coincide con su valoración',
      'FX_INSUFICIENTE'
    )
  }

  return canonical
}

interface CuentaPorCobrarValoradaPersistida {
  monedaOriginal: string | null
  montoOriginal: Prisma.Decimal | string | null
  montoDeudaFuncional: Prisma.Decimal | string | null
  monedaFuncional: string | null
  tasaCambio: Prisma.Decimal | string | null
  rateEffectiveAt: Date | null
  fxProvenanceKind: string | null
  fxProvenanceSource: string | null
  fxCatalogRateId: string | null
  fxEvidenceJson: unknown
  fxEvidenceFingerprint: string | null
  fxEvidenceVersion: number | null
}

/**
 * @description Valida el snapshot que acaba de devolver Prisma y lo convierte en
 * la valoración que recibirá el evento. El evento no puede usar la valoración
 * transitoria calculada antes del upsert, porque un reintento debe conservar la
 * evidencia capturada originalmente en la CxC.
 * @param {CuentaPorCobrarValoradaPersistida} cuenta - Fila CxC persistida.
 * @returns {object} Valoración persistida para construir el evento.
 */
function resolverValoracionPersistidaParaEvento(
  cuenta: CuentaPorCobrarValoradaPersistida,
): {
  monto: Prisma.Decimal | string
  valoracion: {
    moneda: string
    montoFuncional: Prisma.Decimal | string
    monedaFuncional: string
    tasaCambio: Prisma.Decimal | string | null
    fxEvidenceFingerprint: string
  }
} {
  const originalCurrency = cuenta.monedaOriginal?.trim().toUpperCase()
  const functionalCurrency = cuenta.monedaFuncional?.trim().toUpperCase()
  const source = cuenta.fxProvenanceSource?.trim()

  if (
    !originalCurrency ||
    !functionalCurrency ||
    cuenta.montoOriginal == null ||
    cuenta.montoDeudaFuncional == null ||
    !cuenta.fxEvidenceJson ||
    !cuenta.fxEvidenceFingerprint ||
    cuenta.fxEvidenceVersion !== 2 ||
    source !== FUENTE_FX_CXC_VENTA
  ) {
    throw new ActionError(
      'La cuenta por cobrar no tiene una valoración FX persistida y verificable',
      'FX_INSUFICIENTE'
    )
  }

  const isSameCurrency = originalCurrency === functionalCurrency
  if (
    (isSameCurrency && cuenta.fxProvenanceKind !== 'SAME_CURRENCY') ||
    (!isSameCurrency && cuenta.fxProvenanceKind !== 'CATALOG_RATE')
  ) {
    throw new ActionError(
      'La procedencia de la valoración FX persistida no es válida',
      'FX_INSUFICIENTE'
    )
  }

  let canonical: ReturnType<typeof buildAppliedFxEvidenceExact>
  try {
    canonical = buildAppliedFxEvidenceExact({
      originalAmount: cuenta.montoOriginal,
      originalCurrency,
      functionalCurrency,
      exchangeRate: cuenta.tasaCambio,
      convertedAmount: cuenta.montoDeudaFuncional,
      rateEffectiveAt: cuenta.rateEffectiveAt,
      source,
      fxCatalogRateId: cuenta.fxCatalogRateId,
      fxProvenanceKind: isSameCurrency ? undefined : 'CATALOG_RATE',
    })
  } catch (error) {
    throw new ActionError(
      error instanceof Error
        ? error.message
        : 'La valoración FX persistida no es verificable',
      'FX_INSUFICIENTE'
    )
  }

  if (
    canonical.evidence.fxEvidenceFingerprint !== cuenta.fxEvidenceFingerprint ||
    canonical.evidence.fxEvidenceVersion !== cuenta.fxEvidenceVersion ||
    canonical.evidence.fxProvenanceKind !== cuenta.fxProvenanceKind
  ) {
    throw new ActionError(
      'La evidencia FX persistida no coincide con su valoración',
      'FX_INSUFICIENTE'
    )
  }

  return {
    monto: cuenta.montoOriginal,
    valoracion: {
      moneda: originalCurrency,
      montoFuncional: cuenta.montoDeudaFuncional,
      monedaFuncional: functionalCurrency,
      tasaCambio: cuenta.tasaCambio,
      fxEvidenceFingerprint: cuenta.fxEvidenceFingerprint,
    },
  }
}

export async function applyFacturacionCobroWorkflow(
  tx: Prisma.TransactionClient,
  params: FacturacionCobroWorkflowParams
): Promise<{ tipoVencimiento: TipoVencimientoFactura; reconciliacionId: string | null }> {
  let montoTotal: Prisma.Decimal
  try {
    montoTotal = new Prisma.Decimal(params.montoTotal || 0)
  } catch {
    throw new Error('El monto total de la factura debe ser mayor que cero')
  }
  if (!montoTotal.isFinite() || montoTotal.lte(0)) {
    throw new Error('El monto total de la factura debe ser mayor que cero')
  }

  const tipoVencimiento = params.tipoVencimiento
    ? normalizeTipoVencimiento(params.tipoVencimiento)
    : (params.fechaVencimiento ? 'fecha' : 'contra_pago')

  const fechaVencimiento = resolveFechaVencimiento(
    tipoVencimiento,
    params.fechaVencimiento
  )

  // MIXTO con vencimiento: la porción cobrada hoy (efectivo+tarjeta+
  // transferencia) se clampa al total; el remanente es la deuda realmente
  // pendiente que se convierte en CxC. Si lo cobrado hoy cubre el total, el
  // flujo equivale a contra_pago (sin CxC). Aritmética decimal exacta.
  let cobradoHoyBruto: Prisma.Decimal
  try {
    cobradoHoyBruto = new Prisma.Decimal(params.montoCobradoContado ?? 0)
    if (!cobradoHoyBruto.isFinite()) cobradoHoyBruto = new Prisma.Decimal(0)
  } catch {
    cobradoHoyBruto = new Prisma.Decimal(0)
  }
  const cobradoHoyClamp = cobradoHoyBruto.gt(montoTotal) ? montoTotal : cobradoHoyBruto
  const cobradoHoy = cobradoHoyClamp.gt(0) ? cobradoHoyClamp : new Prisma.Decimal(0)
  const diferenciaCredito = montoTotal.sub(cobradoHoy)
  const montoCredito = diferenciaCredito.gt(0) ? diferenciaCredito : new Prisma.Decimal(0)

  if (tipoVencimiento === 'contra_pago' || montoCredito.lte(0)) {
    const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId, params.tenantId)
    const referenciaCobro = `AUTO-${params.facturaId.slice(-8)}`

    const fechaReconciliacion = new Date()
    const monedaFuncionalContado = await requireMonedaFuncionalVenta(tx, params.tenantId)
    const conversion = buildPersistedAccountingAmount(
      montoTotal,
      cuenta.moneda,
      undefined,
      fechaReconciliacion,
      undefined,
      monedaFuncionalContado
    )
    if (!conversion.fxEvidence || conversion.montoConvertido == null) {
      throw new ActionError('Falta evidencia FX funcional para el cobro contra pago', 'FX_INSUFICIENTE')
    }

    // Snapshot de cuenta nativa (FX-3): la cuenta se acredita en su propia moneda.
    const movimientoCuentaContraPago = resolveAccountingAccountMovement({
      tenderAmount: montoTotal,
      tenderCurrency: cuenta.moneda,
      functionalAmount: conversion.montoConvertido as Prisma.Decimal,
      functionalCurrency: monedaFuncionalContado,
      accountCurrency: cuenta.moneda,
    })

    const reconciliacion = await tx.reconciliacionVenta.create({
      data: {
        tenantId: params.tenantId,
        ventaId: params.ventaId,
        cuentaId: cuenta.cuentaId,
        tipoPagoId: tipoPago.tipoId,
        monto: montoTotal,
        moneda: cuenta.moneda,
        montoCuenta: movimientoCuentaContraPago.amount,
        monedaCuenta: movimientoCuentaContraPago.currency,
        ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
        ...(conversion.montoConvertido != null
          ? { montoConvertido: conversion.montoConvertido }
          : {}),
        fechaReconciliacion,
        ...(conversion.fxEvidence ?? {}),
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
          increment: montoTotal.toNumber()
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

    // Capa de contabilidad formal: la factura cobrada al contado genera su asiento.
    await postEvento(tx, { tenantId: params.tenantId, userId: params.usuarioId }, buildEventoVentaContado({
      reconciliacionId: reconciliacion.reconciliacionId,
      descripcion: params.observaciones || `Cobro total por contra pago`,
      fecha: fechaReconciliacion,
    tesoreria: {
      monto: montoTotal,
      moneda: cuenta.moneda,
      montoFuncional: conversion.montoConvertido ?? montoTotal,
      monedaFuncionalCodigo: conversion.fxEvidence?.functionalCurrency ?? null,
      tasaCambio: conversion.tasaCambio,
      fxEvidenceFingerprint: conversion.fxEvidence?.fxEvidenceFingerprint ?? null,
      tipoCuenta: cuenta.tipoCuenta,
      referencia: referenciaCobro,
    },
  }))

  return {
    tipoVencimiento,
    reconciliacionId: reconciliacion.reconciliacionId
  }
  }

  const fechaOperacion = new Date()
  const modoFormal = modoFormalActual()

  // MIXTO con vencimiento: la porción cobrada hoy se concilia y abona al
  // banco en esta misma transacción (igual que un contra_pago parcial); el
  // asiento al contado es por lo cobrado hoy y la CxC queda por el remanente.
  let reconciliacionContadoId: string | null = null
  let cuentaContado: CuentaTipoPagoResolucion['cuenta'] | null = null
  if (cobradoHoy.gt(0)) {
    const { cuenta, tipoPago } = await resolveCuentaYTipoPago(tx, params.cuentaBancariaId, params.tenantId)
    const fechaReconciliacionContado = new Date()
    const monedaFuncionalMixto = await requireMonedaFuncionalVenta(tx, params.tenantId)
    const conversionContado = buildPersistedAccountingAmount(
      cobradoHoy,
      cuenta.moneda,
      undefined,
      fechaReconciliacionContado,
      undefined,
      monedaFuncionalMixto
    )
    if (!conversionContado.fxEvidence || conversionContado.montoConvertido == null) {
      throw new ActionError('Falta evidencia FX funcional para el cobro parcial mixto', 'FX_INSUFICIENTE')
    }
    // Snapshot de cuenta nativa (FX-3): la cuenta se acredita en su propia moneda.
    const movimientoCuentaMixto = resolveAccountingAccountMovement({
      tenderAmount: cobradoHoy,
      tenderCurrency: cuenta.moneda,
      functionalAmount: conversionContado.montoConvertido as Prisma.Decimal,
      functionalCurrency: monedaFuncionalMixto,
      accountCurrency: cuenta.moneda,
    })
    const reconciliacionContado = await tx.reconciliacionVenta.create({
      data: {
        tenantId: params.tenantId,
        ventaId: params.ventaId,
        cuentaId: cuenta.cuentaId,
        tipoPagoId: tipoPago.tipoId,
        monto: cobradoHoy,
        moneda: cuenta.moneda,
        montoCuenta: movimientoCuentaMixto.amount,
        monedaCuenta: movimientoCuentaMixto.currency,
        ...(conversionContado.tasaCambio != null ? { tasaCambio: conversionContado.tasaCambio } : {}),
        ...(conversionContado.montoConvertido != null
          ? { montoConvertido: conversionContado.montoConvertido }
          : {}),
        fechaReconciliacion: fechaReconciliacionContado,
        ...(conversionContado.fxEvidence ?? {}),
        observaciones: params.observaciones || `Cobro parcial al contado de la venta a crédito`,
        reconciliadoPor: params.usuarioId
      }
    })
    reconciliacionContadoId = reconciliacionContado.reconciliacionId
    cuentaContado = cuenta

    await tx.cuentaBancaria.update({
      where: { cuentaId: cuenta.cuentaId },
      data: {
        saldo: {
          increment: cobradoHoy.toNumber()
        }
      }
    })

    await postEvento(tx, { tenantId: params.tenantId, userId: params.usuarioId }, buildEventoVentaContado({
      reconciliacionId: reconciliacionContado.reconciliacionId,
      descripcion: params.observaciones || 'Cobro parcial al contado de la venta a crédito',
      fecha: fechaReconciliacionContado,
      tesoreria: {
        monto: cobradoHoy,
        moneda: cuenta.moneda,
        montoFuncional: conversionContado.montoConvertido ?? cobradoHoy,
        monedaFuncionalCodigo: conversionContado.fxEvidence?.functionalCurrency ?? null,
        tasaCambio: conversionContado.tasaCambio,
        fxEvidenceFingerprint: conversionContado.fxEvidence?.fxEvidenceFingerprint ?? null,
        tipoCuenta: cuenta.tipoCuenta,
        referencia: params.facturaId,
      },
    }))
  }

  let valoracion: ExactAppliedFxEvidence | null = null
  if (modoFormal !== 'off') {
    try {
      const functionalCurrency = await requireMonedaFuncionalVenta(tx, params.tenantId)
      valoracion = resolverValoracionVentaCredito({
        amount: montoCredito,
        functionalCurrency,
        originalCurrency: params.monedaOriginal,
        valoracion: params.valoracion,
      })
    } catch (error) {
      if (modoFormal !== 'shadow' || !esErrorValoracionFormal(error)) throw error
    }
  }

  let montoNominalInconsistente = false
  if (modoFormal !== 'off') {
    const cuentaExistente = await tx.cuentaPorCobrar.findUnique({
      where: { facturaId: params.facturaId },
      select: { montoDeuda: true },
    })
    if (cuentaExistente) {
      const montoExistente = new Prisma.Decimal(cuentaExistente.montoDeuda)
      montoNominalInconsistente = !montoExistente.eq(new Prisma.Decimal(montoCredito))
      if (modoFormal === 'enforce' && montoNominalInconsistente) {
        throw new ActionError(
          'El monto nominal de la cuenta por cobrar no coincide con el total de la factura',
          'CXC_MONTO_INCONSISTENTE'
        )
      }
    }
  }
  // `buildAppliedFxEvidenceExact` ya rechazó importes que no caben en cuatro
  // decimales; conservar su resultado evita cuantizar silenciosamente el valor.
  const snapshotValoracion = valoracion
    ? {
        monedaOriginal: valoracion.evidence.originalCurrency,
        montoOriginal: valoracion.evidence.originalAmount,
        montoDeudaFuncional: valoracion.montoConvertido,
        monedaFuncional: valoracion.evidence.functionalCurrency,
        tasaCambio: valoracion.tasaCambio,
        rateEffectiveAt: valoracion.rateEffectiveAt,
        fxProvenanceKind: valoracion.evidence.fxProvenanceKind,
        fxProvenanceSource: valoracion.evidence.fxProvenanceSource,
        fxCatalogRateId: valoracion.evidence.fxCatalogRateId,
        fxEvidenceJson: { ...valoracion.evidence },
        fxEvidenceFingerprint: valoracion.evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: valoracion.evidence.fxEvidenceVersion
      }
    : {}

  // La valuación de la CxC es inmutable y se captura al crear la cuenta; la
  // reemisión de términos sobre una fila existente no toca su valuación
  // preexistente (el update no la sobrescribe).
  const cuentaPorCobrar = await tx.cuentaPorCobrar.upsert({
    where: { facturaId: params.facturaId },
    update: {
      clienteId: params.clienteId,
      montoDeuda: montoCredito,
      fechaVencimiento
    },
    create: {
      tenantId: params.tenantId,
      facturaId: params.facturaId,
      clienteId: params.clienteId,
      montoDeuda: montoCredito,
      montoPagado: 0,
      estado: 'PENDIENTE',
      fechaVencimiento,
      ...snapshotValoracion
    }
  })

  await tx.factura.update({
    where: { idFactura: params.facturaId },
    data: {
      estado: 'PENDIENTE',
      fechaVencimiento
    }
  })

  // Capa de contabilidad formal: la venta a crédito genera su asiento
  // (debe Clientes, haber Ventas) respaldado por la CxC recién creada y
  // valorada con la evidencia persistida en la misma transacción.
  let eventoValoracion: ReturnType<typeof resolverValoracionPersistidaParaEvento> | null = null
  if (valoracion && !(modoFormal === 'shadow' && montoNominalInconsistente)) {
    try {
      eventoValoracion = resolverValoracionPersistidaParaEvento(
        cuentaPorCobrar as CuentaPorCobrarValoradaPersistida
      )
    } catch (error) {
      if (modoFormal !== 'shadow' || !esErrorValoracionFormal(error)) throw error
    }
  }
  await postEvento(tx, { tenantId: params.tenantId, userId: params.usuarioId }, buildEventoVentaCredito({
    facturaId: params.facturaId,
    monto: eventoValoracion?.monto ?? montoCredito,
    ...(eventoValoracion ? { valoracion: eventoValoracion.valoracion } : {}),
    descripcion: params.observaciones || `Venta a crédito (${params.facturaId.slice(-8)})`,
    fecha: fechaOperacion,
    referencia: params.facturaId,
  }))

  return { tipoVencimiento, reconciliacionId: reconciliacionContadoId }
}
