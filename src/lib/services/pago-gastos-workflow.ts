import type { Prisma } from '@/generated/prisma'
import { normalizeAccountingAmount } from '@/features/contabilidad/domain/accounting-amount'

/**
 * @description Representa un error funcional del workflow de pago de gastos.
 */
interface GastoWorkflowError extends Error {
  status: number
  code: string
}

/**
 * @description Distribución de pago por cuenta bancaria.
 */
export interface GastoWorkflowDistribucion {
  cuentaId: string
  monto: number
  porcentaje?: number
}

/**
 * @description Entrada del workflow unificado de pago de gastos/CxP.
 */
export interface ApplyPagoGastoWorkflowParams {
  tipoGasto: 'salario' | 'gastoDE' | 'compra' | 'servicio' | 'venta_servicio'
  referenciaId: string
  reconciliadoPor: string
  descripcion: string
  monto: number
  moneda: string
  tenantId: string
  tasaCambio?: number
  periodo?: string
  observaciones?: string
  estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL'
  cuentaPorPagarId?: string
  numeroTransaccion?: string
  cuentaProveedor?: string
  fechaPago?: Date | string
  pgId?: string
  gastosDEId?: string
  gastoCompraId?: string
  cuentaId?: string
  tipoPagoId?: string
  distribucion?: GastoWorkflowDistribucion[]
}

/**
 * @description Resultado del workflow de pago de gastos/CxP.
 */
export interface ApplyPagoGastoWorkflowResult {
  reconciliaciones: Array<{
    reconciliacionId: string
    cuentaId: string
    monto: number
    moneda: string
    montoConvertido: number | null
    descripcion: string
  }>
  cuentaPorPagar: {
    cuentaPorPagarId: string
    estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA'
    montoPagado: number
    saldoPendiente: number
  } | null
  pagoCuentaPorPagar: {
    pagoCuentaPorPagarId: string
    numeroTransaccion: string
    monto: number
  } | null
}

/**
 * @description Crea un error de negocio del workflow con status HTTP.
 * @param {number} status - Código HTTP.
 * @param {string} code - Código de negocio.
 * @param {string} message - Mensaje de error.
 * @returns {GastoWorkflowError} Error tipado.
 */
function createGastoWorkflowError(
  status: number,
  code: string,
  message: string
): GastoWorkflowError {
  const error = new Error(message) as GastoWorkflowError
  error.status = status
  error.code = code
  return error
}

async function lockAndValidateReference(
  tx: Prisma.TransactionClient,
  params: ApplyPagoGastoWorkflowParams,
): Promise<void> {
  const tableByType = {
    salario: 'Pagosalario',
    gastoDE: 'GastosDE',
    compra: 'GastoCompra',
    servicio: 'CompraServicio',
    venta_servicio: 'VentaServicios',
  } as const
  const table = tableByType[params.tipoGasto]
  const idColumnByType = {
    salario: 'pgId',
    gastoDE: 'gastosDEId',
    compra: 'gastoCompraId',
    servicio: 'compraServicioId',
    venta_servicio: 'ventaServicioId',
  } as const
  const idColumn = idColumnByType[params.tipoGasto]
  await tx.$queryRawUnsafe(
    `SELECT 1 FROM "${table}" WHERE "${idColumn}" = $1 AND "tenantId" = $2 FOR UPDATE`,
    params.referenciaId,
    params.tenantId,
  )

  let source: { tenantId: string; deletedAt?: Date | null; estado?: string | null; isPagado?: string | null; numeroFactura?: string | null } | null = null
  if (params.tipoGasto === 'salario') {
    source = await tx.pagosalario.findFirst({ where: { pgId: params.referenciaId, tenantId: params.tenantId }, select: { tenantId: true } })
  } else if (params.tipoGasto === 'gastoDE') {
    source = await tx.gastosDE.findFirst({ where: { gastosDEId: params.referenciaId, tenantId: params.tenantId }, select: { tenantId: true, isPagado: true } })
  } else if (params.tipoGasto === 'compra') {
    source = await tx.gastoCompra.findFirst({ where: { gastoCompraId: params.referenciaId, tenantId: params.tenantId }, select: { tenantId: true, deletedAt: true } })
  } else if (params.tipoGasto === 'servicio') {
    source = await tx.compraServicio.findFirst({ where: { compraServicioId: params.referenciaId, tenantId: params.tenantId }, select: { tenantId: true, estado: true, numeroFactura: true } })
  } else {
    source = await tx.ventaServicios.findFirst({ where: { ventaServicioId: params.referenciaId, tenantId: params.tenantId }, select: { tenantId: true } })
  }
  if (!source || source.tenantId !== params.tenantId || source.deletedAt || source.isPagado === 'ELIMINANDO' || source.estado === 'ELIMINANDO') {
    throw createGastoWorkflowError(404, 'REFERENCIA_NO_ENCONTRADA', 'Referencia de gasto no encontrada o eliminada')
  }
  if (params.cuentaPorPagarId) {
    if (params.tipoGasto === 'salario') {
      throw createGastoWorkflowError(400, 'CXP_NO_PERTENECE', 'La nómina no puede asociarse a una cuenta por pagar de compras')
    }
    const payableWhere = params.tipoGasto === 'gastoDE'
      ? { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId, gastosDEId: params.referenciaId }
      : params.tipoGasto === 'compra'
        ? { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId, gastoCompraId: params.referenciaId }
        : {
            cuentaPorPagarId: params.cuentaPorPagarId,
            tenantId: params.tenantId,
            tipo: 'servicio' as const,
            numeroFactura: source.numeroFactura || '__MISSING_SERVICE_INVOICE__',
          }
    const payable = await tx.cuentaPorPagar.findFirst({ where: payableWhere, select: { cuentaPorPagarId: true } })
    if (!payable) {
      throw createGastoWorkflowError(400, 'CXP_NO_PERTENECE', 'La cuenta por pagar no pertenece al gasto')
    }
  }
}

/**
 * @description Determina si un error corresponde a una validación de workflow.
 * @param {unknown} error - Error a evaluar.
 * @returns {boolean} `true` si es un error tipado del workflow.
 */
export function isGastoWorkflowError(error: unknown): error is GastoWorkflowError {
  if (!error || typeof error !== 'object') {
    return false
  }
  const candidate = error as { status?: unknown; code?: unknown }
  return typeof candidate.status === 'number' && typeof candidate.code === 'string'
}

/**
 * @description Normaliza un monto a CUP y rechaza conversiones incompletas.
 * @param {number} monto - Monto original.
 * @param {string} moneda - Moneda origen.
 * @param {number | undefined} tasaCambio - Tasa opcional.
 * @param {Date} fechaOperacion - Fecha en que se aplicó la tasa informada.
 * @returns {number} Monto normalizado en CUP.
 */
function normalizeMontoToCup(
  monto: number,
  moneda: string,
  tasaCambio: number | undefined,
  fechaOperacion: Date,
): number {
  const hasValidRate =
    typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0
  const result = normalizeAccountingAmount({
    amount: monto,
    currency: moneda,
    functionalCurrency: 'CUP',
    convertedAmount: hasValidRate ? monto * tasaCambio : null,
    exchangeRate: tasaCambio,
    operationAt: fechaOperacion,
    rateEffectiveAt: hasValidRate ? fechaOperacion : null,
  })

  if (result.status === 'unresolved') {
    throw createGastoWorkflowError(
      400,
      'CONVERSION_REQUERIDA',
      `No se puede expresar el pago en CUP: ${result.issue}`,
    )
  }
  return result.amount
}

/**
 * @description Convierte monto a la moneda de la cuenta bancaria.
 * @param {number} monto - Monto original.
 * @param {string} monedaPago - Moneda origen del pago.
 * @param {string} monedaCuenta - Moneda de la cuenta.
 * @param {number | undefined} tasaCambio - Tasa opcional.
 * @returns {number} Monto convertido a moneda de cuenta.
 */
function convertMontoToCuentaMoneda(
  monto: number,
  monedaPago: string,
  monedaCuenta: string,
  tasaCambio?: number
): number {
  if (monedaPago === monedaCuenta) {
    return monto
  }
  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) {
    return monto * tasaCambio
  }
  return monto
}

/**
 * @description Resuelve tipo de pago activo para registrar el egreso.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {string | undefined} tipoPagoId - Tipo de pago opcional.
 * @returns {Promise<{ tipoId: string; cuentaDefecto: string | null }>} Tipo de pago resuelto.
 */
async function resolveTipoPago(
  tx: Prisma.TransactionClient,
  tipoPagoId?: string,
  tenantId?: string
): Promise<{ tipoId: string; cuentaDefecto: string | null }> {
  const tipoPago = tipoPagoId
    ? await tx.tipoPago.findUnique({
        where: { tipoId: tipoPagoId, tenantId },
        select: { tipoId: true, isActive: true, cuentaDefecto: true }
      })
    : await tx.tipoPago.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
        select: { tipoId: true, isActive: true, cuentaDefecto: true }
      })

  if (!tipoPago || !tipoPago.isActive) {
    throw createGastoWorkflowError(404, 'TIPO_PAGO_INACTIVO', 'Tipo de pago no encontrado o inactivo')
  }

  return {
    tipoId: tipoPago.tipoId,
    cuentaDefecto: tipoPago.cuentaDefecto || null
  }
}

/**
 * @description Resuelve una cuenta activa para flujo de pago simple.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {string | undefined} cuentaId - Cuenta explícita opcional.
 * @param {string | null} cuentaDefectoId - Cuenta por defecto de tipo de pago.
 * @returns {Promise<string>} ID de cuenta resuelta.
 */
async function resolveCuentaId(
  tx: Prisma.TransactionClient,
  cuentaId?: string,
  cuentaDefectoId?: string | null,
  tenantId?: string,
): Promise<string> {
  if (cuentaId) {
    const cuenta = await tx.cuentaBancaria.findFirst({
      where: { cuentaId, tenantId },
      select: { cuentaId: true, isActive: true }
    })
    if (cuenta?.isActive) {
      return cuenta.cuentaId
    }
    throw createGastoWorkflowError(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta bancaria no encontrada o inactiva')
  }

  if (cuentaDefectoId) {
    const cuentaDefecto = await tx.cuentaBancaria.findFirst({
      where: { cuentaId: cuentaDefectoId, tenantId },
      select: { cuentaId: true, isActive: true }
    })
    if (cuentaDefecto?.isActive) {
      return cuentaDefecto.cuentaId
    }
  }

  const cuentaFallback = await tx.cuentaBancaria.findFirst({
    where: { isActive: true, tenantId },
    orderBy: { createdAt: 'asc' },
    select: { cuentaId: true }
  })
  if (!cuentaFallback) {
    throw createGastoWorkflowError(
      400,
      'NO_CUENTA_ACTIVA',
      'No hay cuentas bancarias activas para registrar el pago'
    )
  }
  return cuentaFallback.cuentaId
}

/**
 * @description Construye la distribución efectiva de pagos.
 * @param {ApplyPagoGastoWorkflowParams} params - Parámetros del flujo.
 * @param {string | null} cuentaIdDefault - Cuenta fallback para pago simple.
 * @returns {GastoWorkflowDistribucion[]} Distribución validada.
 */
function buildDistribucion(
  params: ApplyPagoGastoWorkflowParams,
  cuentaIdDefault: string | null
): GastoWorkflowDistribucion[] {
  if (Array.isArray(params.distribucion) && params.distribucion.length > 0) {
    const sum = params.distribucion.reduce((acc, dist) => acc + Number(dist.monto || 0), 0)
    if (Math.abs(sum - params.monto) > 0.01) {
      throw createGastoWorkflowError(
        400,
        'DISTRIBUCION_INVALIDA',
        'La suma de la distribución no coincide con el monto total'
      )
    }
    return params.distribucion
  }

  if (!cuentaIdDefault) {
    throw createGastoWorkflowError(
      400,
      'CUENTA_REQUERIDA',
      'Debe indicar una cuenta bancaria para registrar el pago'
    )
  }

  return [
    {
      cuentaId: cuentaIdDefault,
      monto: params.monto,
      porcentaje: 100
    }
  ]
}

/**
 * @description Aplica el workflow unificado de pago de gastos y cuentas por pagar.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {ApplyPagoGastoWorkflowParams} params - Parámetros del pago.
 * @returns {Promise<ApplyPagoGastoWorkflowResult>} Resultado de la operación.
 */
export async function applyPagoGastoWorkflow(
  tx: Prisma.TransactionClient,
  params: ApplyPagoGastoWorkflowParams
): Promise<ApplyPagoGastoWorkflowResult> {
  const montoTotal = Number(params.monto || 0)
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw createGastoWorkflowError(400, 'MONTO_INVALIDO', 'El monto debe ser mayor que cero')
  }
  const fechaOperacion = params.fechaPago ? new Date(params.fechaPago) : new Date()
  const montoTotalConvertido = normalizeMontoToCup(
    montoTotal,
    params.moneda,
    params.tasaCambio,
    fechaOperacion,
  )

  // Every source reference is a non-composite foreign key. Lock and validate
  // tenant ownership before touching bank/CxP state to close deletion races.
  await lockAndValidateReference(tx, params)

  const estadoSolicitado = params.estado || 'PAGADA'
  let estadoReconciliacion: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' = estadoSolicitado
  const tipoPago = await resolveTipoPago(tx, params.tipoPagoId, params.tenantId)
  const cuentaIdForSimplePago = await resolveCuentaId(
    tx,
    params.cuentaId,
    tipoPago.cuentaDefecto,
    params.tenantId,
  )
  const distribucion = buildDistribucion(params, cuentaIdForSimplePago)

  if (!params.cuentaPorPagarId && estadoReconciliacion !== 'PENDIENTE') {
    const pagoPrevio = await tx.reconciliacionGasto.findFirst({
      where: {
        tenantId: params.tenantId,
        tipoGasto: params.tipoGasto,
        referenciaId: params.referenciaId,
        estado: {
          in: ['PAGADA', 'PARCIAL']
        }
      },
      select: { reconciliacionId: true }
    })
    if (pagoPrevio) {
      throw createGastoWorkflowError(409, 'GASTO_YA_RECONCILIADO', 'Este gasto ya fue reconciliado')
    }
  }

  let cuentaPorPagarActual: {
    cuentaPorPagarId: string
    estado: string
    montoPagado: Prisma.Decimal | number
    saldoPendiente: Prisma.Decimal | number
    gastoCompraId: string | null
    proveedor: { cuentaCUP: string | null; cuentaUSD: string | null } | null
  } | null = null

  if (params.cuentaPorPagarId) {
    await tx.$queryRaw`
      SELECT 1 FROM "CuentaPorPagar"
      WHERE "cuentaPorPagarId" = ${params.cuentaPorPagarId}
        AND "tenantId" = ${params.tenantId}
      FOR UPDATE
    `

    cuentaPorPagarActual = await tx.cuentaPorPagar.findFirst({
      where: { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId },
      select: {
        cuentaPorPagarId: true,
        estado: true,
        montoDeuda: true,
        montoPagado: true,
        saldoPendiente: true,
        gastoCompraId: true,
        proveedor: {
          select: {
            cuentaCUP: true,
            cuentaUSD: true
          }
        }
      }
    })

    if (!cuentaPorPagarActual) {
      throw createGastoWorkflowError(
        404,
        'CUENTA_POR_PAGAR_NO_ENCONTRADA',
        'Cuenta por pagar no encontrada'
      )
    }

    if (cuentaPorPagarActual.estado === 'PAGADA') {
      throw createGastoWorkflowError(400, 'CUENTA_YA_PAGADA', 'La cuenta por pagar ya está pagada')
    }

    if (montoTotal > Number(cuentaPorPagarActual.saldoPendiente) + 0.01) {
      throw createGastoWorkflowError(
        400,
        'MONTO_EXCEDE_SALDO',
        `El monto no puede exceder el saldo pendiente de ${Number(cuentaPorPagarActual.saldoPendiente).toFixed(2)}`
      )
    }

    const numeroTransaccion = params.numeroTransaccion?.trim()
    if (numeroTransaccion) {
      const pagoDuplicado = await tx.pagoCuentaPorPagar.findFirst({
        where: {
          cuentaPorPagarId: params.cuentaPorPagarId,
          numeroTransaccion
        },
        select: {
          pagoCuentaPorPagarId: true
        }
      })
      if (pagoDuplicado) {
        throw createGastoWorkflowError(
          409,
          'DUPLICADO_TRANSACCION',
          'Ya existe un pago registrado con ese número de transacción para esta cuenta por pagar'
        )
      }
    }

    const saldoPendienteActual = Number(cuentaPorPagarActual.saldoPendiente || 0)
    const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - montoTotal)
    estadoReconciliacion = nuevoSaldoPendiente <= 0.01 ? 'PAGADA' : 'PARCIAL'
  }

  const cuentaIds = Array.from(new Set(distribucion.map((dist) => dist.cuentaId)))
  for (const cuentaId of cuentaIds) {
    await tx.$queryRaw`
      SELECT 1 FROM "CuentaBancaria"
      WHERE "cuentaId" = ${cuentaId} AND "tenantId" = ${params.tenantId}
      FOR UPDATE
    `
  }

  const cuentas = await tx.cuentaBancaria.findMany({
    where: { cuentaId: { in: cuentaIds }, tenantId: params.tenantId },
    select: {
      cuentaId: true,
      moneda: true,
      saldo: true,
      isActive: true
    }
  })
  const cuentaMap = new Map(cuentas.map((cuenta) => [cuenta.cuentaId, cuenta]))

  const saldosADescontar = new Map<string, number>()
  for (const pago of distribucion) {
    const cuenta = cuentaMap.get(pago.cuentaId)
    if (!cuenta || !cuenta.isActive) {
      throw createGastoWorkflowError(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta bancaria no encontrada o inactiva')
    }

    const montoEnCuenta = convertMontoToCuentaMoneda(
      Number(pago.monto),
      params.moneda,
      cuenta.moneda,
      params.tasaCambio
    )

    const acumulado = saldosADescontar.get(cuenta.cuentaId) || 0
    saldosADescontar.set(cuenta.cuentaId, acumulado + montoEnCuenta)
  }

  if (estadoReconciliacion !== 'PENDIENTE') {
    for (const [cuentaId, montoDescontar] of saldosADescontar.entries()) {
      const cuenta = cuentaMap.get(cuentaId)
      if (!cuenta) {
        continue
      }
      if (Number(cuenta.saldo) < montoDescontar - 0.000001) {
        throw createGastoWorkflowError(
          400,
          'SALDO_INSUFICIENTE',
          `Saldo insuficiente en la cuenta ${cuentaId}`
        )
      }
    }
  }

  const reconciliaciones: ApplyPagoGastoWorkflowResult['reconciliaciones'] = []
  for (const pago of distribucion) {
    const montoPago = Number(pago.monto)
    const montoConvertido = normalizeMontoToCup(
      montoPago,
      params.moneda,
      params.tasaCambio,
      fechaOperacion,
    )

    const reconciliacion = await tx.reconciliacionGasto.create({
      data: {
        tenantId: params.tenantId,
        tipoGasto: params.tipoGasto,
        referenciaId: params.referenciaId,
        cuentaId: pago.cuentaId,
        tipoPagoId: tipoPago.tipoId,
        pgId: params.pgId,
        gastosDEId: params.gastosDEId,
        gastoCompraId: params.gastoCompraId,
        cuentaPorPagarId: params.cuentaPorPagarId,
        monto: montoPago,
        moneda: params.moneda,
        tasaCambio: params.tasaCambio,
        montoConvertido,
        descripcion:
          typeof pago.porcentaje === 'number'
            ? `${params.descripcion} (${pago.porcentaje}%)`
            : params.descripcion,
        periodo: params.periodo,
        observaciones: params.observaciones,
        estado: estadoReconciliacion,
        reconciliadoPor: params.reconciliadoPor
      },
      select: {
        reconciliacionId: true,
        cuentaId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        descripcion: true
      }
    })

    reconciliaciones.push({
      reconciliacionId: reconciliacion.reconciliacionId,
      cuentaId: reconciliacion.cuentaId,
      monto: Number(reconciliacion.monto),
      moneda: reconciliacion.moneda,
      montoConvertido:
        reconciliacion.montoConvertido === null ? null : Number(reconciliacion.montoConvertido),
      descripcion: reconciliacion.descripcion
    })
  }

  if (estadoReconciliacion !== 'PENDIENTE') {
    for (const [cuentaId, montoDescontar] of saldosADescontar.entries()) {
      const updated = await tx.cuentaBancaria.updateMany({
        where: { cuentaId, tenantId: params.tenantId },
        data: {
          saldo: {
            decrement: montoDescontar
          }
        }
      })
      if (updated.count !== 1) {
        throw createGastoWorkflowError(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta bancaria no encontrada')
      }
    }
  }

  if (params.moneda !== 'CUP' && params.tasaCambio) {
    await tx.transaccionMoneda.create({
      data: {
        tipoTransaccion: 'gasto',
        referenciaId: params.referenciaId,
        monedaId: params.moneda,
        montoOriginal: montoTotal,
        tasaCambio: params.tasaCambio,
        montoConvertido: montoTotalConvertido
      }
    })
  }

  let cuentaPorPagarResult: ApplyPagoGastoWorkflowResult['cuentaPorPagar'] = null
  let pagoCuentaPorPagarResult: ApplyPagoGastoWorkflowResult['pagoCuentaPorPagar'] = null

  if (cuentaPorPagarActual && params.cuentaPorPagarId) {
    const montoPagadoActual = Number(cuentaPorPagarActual.montoPagado || 0)
    const saldoPendienteActual = Number(cuentaPorPagarActual.saldoPendiente || 0)
    const montoDeudaActual = Number(cuentaPorPagarActual.montoDeuda || 0)
    const nuevoMontoPagado = montoPagadoActual + montoTotal
    const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - montoTotal)
    const nuevoEstado = estadoReconciliacion === 'PAGADA' ? 'PAGADA' : 'PARCIAL'

    // Protección: montoPagado nunca debe exceder montoDeuda
    if (nuevoMontoPagado > montoDeudaActual + 0.01) {
      throw createGastoWorkflowError(
        400,
        'MONTO_EXCEDE_DEUDA',
        `El pago de ${montoTotal.toFixed(2)} excedería el monto de la deuda (${montoDeudaActual.toFixed(2)}). Monto actual pagado: ${montoPagadoActual.toFixed(2)}.`
      )
    }
    const fechaPago =
      params.fechaPago instanceof Date
        ? params.fechaPago
        : params.fechaPago
        ? new Date(params.fechaPago)
        : new Date()
    const fechaPagoNormalizada = Number.isNaN(fechaPago.getTime()) ? new Date() : fechaPago

    const cuentaActualizada = await tx.cuentaPorPagar.updateMany({
      where: { cuentaPorPagarId: params.cuentaPorPagarId, tenantId: params.tenantId },
      data: {
        estado: nuevoEstado,
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente
      }
    })
    if (cuentaActualizada.count !== 1) {
      throw createGastoWorkflowError(404, 'CUENTA_POR_PAGAR_NO_ENCONTRADA', 'Cuenta por pagar no encontrada')
    }

    const cuentaProveedor =
      params.cuentaProveedor ||
      (params.moneda === 'USD'
        ? cuentaPorPagarActual.proveedor?.cuentaUSD
        : cuentaPorPagarActual.proveedor?.cuentaCUP) ||
      'N/A'
    const numeroTransaccion = params.numeroTransaccion?.trim() || reconciliaciones[0]?.reconciliacionId
    const reconciliationMarker = `reconciliationIds:${reconciliaciones
      .map((reconciliacion) => reconciliacion.reconciliacionId)
      .join(',')}`

    const pagoRegistrado = await tx.pagoCuentaPorPagar.create({
      data: {
        tenantId: params.tenantId,
        cuentaPorPagarId: params.cuentaPorPagarId,
        monto: montoTotal,
        numeroTransaccion: numeroTransaccion || 'N/A',
        cuentaProveedor,
        fechaPago: fechaPagoNormalizada,
        observaciones:
          [
            params.observaciones ||
              `Pago ${nuevoEstado === 'PAGADA' ? 'total' : 'parcial'} vía reconciliación`,
            reconciliationMarker,
          ].join(' | ')
      },
      select: {
        pagoCuentaPorPagarId: true,
        numeroTransaccion: true,
        monto: true
      }
    })

    if (nuevoEstado === 'PAGADA') {
      await tx.compraProducto.updateMany({
        where: {
          OR: [
            { cuentaPorPagarId: params.cuentaPorPagarId },
            ...(cuentaPorPagarActual.gastoCompraId
              ? [{ gastoCompraId: cuentaPorPagarActual.gastoCompraId }]
              : [])
          ]
        },
        data: {
          estado: 'PAGADA'
        }
      })
    }

    cuentaPorPagarResult = {
      cuentaPorPagarId: params.cuentaPorPagarId,
      estado: nuevoEstado as 'PENDIENTE' | 'PARCIAL' | 'PAGADA',
      montoPagado: nuevoMontoPagado,
      saldoPendiente: nuevoSaldoPendiente
    }
    pagoCuentaPorPagarResult = {
      pagoCuentaPorPagarId: pagoRegistrado.pagoCuentaPorPagarId,
      numeroTransaccion: pagoRegistrado.numeroTransaccion,
      monto: Number(pagoRegistrado.monto)
    }
  }

  if (
    params.tipoGasto === 'gastoDE' &&
    params.gastosDEId &&
    estadoReconciliacion === 'PAGADA'
  ) {
    await tx.gastosDE.update({
      where: { gastosDEId: params.gastosDEId },
      data: { isPagado: 'pagado' }
    })
  }

  return {
    reconciliaciones,
    cuentaPorPagar: cuentaPorPagarResult,
    pagoCuentaPorPagar: pagoCuentaPorPagarResult
  }
}
