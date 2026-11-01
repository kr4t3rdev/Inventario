import { Prisma } from '@/generated/prisma'
import { createHash } from 'node:crypto'
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider'
import { emitirEventoAnticipo } from '@/features/contabilidad-formal/services/advance-posting-service'
import {
  AnticipoWorkflowError,
  AnticipoContexto,
  CreateAnticipoParams,
  ExecuteAnticipoParams,
  ExecuteAnticipoResult,
  ExecuteReconciliacionHandler,
  ReverseAnticipoParams,
  AnticipoAllocation,
  AnticipoAllocationResult,
} from '@/lib/services/anticipos-workflow.types'

function createAnticipoWorkflowError(
  status: number,
  code: string,
  message: string
): AnticipoWorkflowError {
  const error = new Error(message) as AnticipoWorkflowError
  error.status = status
  error.code = code
  return error
}

export function isAnticipoWorkflowError(error: unknown): error is AnticipoWorkflowError {
  if (!error || typeof error !== 'object') {
    return false
  }
  const candidate = error as { status?: unknown; code?: unknown }
  return typeof candidate.status === 'number' && typeof candidate.code === 'string'
}

function resolveVigencia(vigenciaHasta?: Date | string): Date | null {
  if (!vigenciaHasta) {
    return null
  }
  const parsed = vigenciaHasta instanceof Date ? vigenciaHasta : new Date(vigenciaHasta)
  if (Number.isNaN(parsed.getTime())) {
    throw createAnticipoWorkflowError(400, 'VIGENCIA_INVALIDA', 'La vigencia del anticipo es inválida')
  }
  return parsed
}

export async function createAnticipo(
  tx: Prisma.TransactionClient,
  params: CreateAnticipoParams
) {
  if (!Number.isFinite(params.monto) || params.monto <= 0) {
    throw createAnticipoWorkflowError(400, 'MONTO_INVALIDO', 'El monto del anticipo debe ser mayor que cero')
  }

  if (params.tipo === 'PAGO' && !params.proveedorId) {
    throw createAnticipoWorkflowError(
      400,
      'PROVEEDOR_REQUERIDO',
      'Para anticipos de pago se requiere proveedor'
    )
  }

  if (params.tipo === 'COBRO' && !params.clienteId) {
    throw createAnticipoWorkflowError(
      400,
      'CLIENTE_REQUERIDO',
      'Para anticipos de cobro se requiere cliente'
    )
  }

  const contrato = await tx.contrato.findUnique({
    where: { contratoId: params.contratoId },
    select: {
      contratoId: true,
      estado: true,
      vendorId: true,
      clienteId: true,
      fechaInicio: true,
      fechaFin: true
    }
  })

  if (!contrato || contrato.estado !== 'ACTIVO') {
    throw createAnticipoWorkflowError(
      400,
      'CONTRATO_INVALIDO',
      'El contrato no existe o no está activo'
    )
  }

  if (params.tipo === 'PAGO' && contrato.vendorId && contrato.vendorId !== params.proveedorId) {
    throw createAnticipoWorkflowError(
      400,
      'PROVEEDOR_NO_COMPATIBLE',
      'El proveedor no corresponde al contrato seleccionado'
    )
  }

  if (params.tipo === 'COBRO' && contrato.clienteId && contrato.clienteId !== params.clienteId) {
    throw createAnticipoWorkflowError(
      400,
      'CLIENTE_NO_COMPATIBLE',
      'El cliente no corresponde al contrato seleccionado'
    )
  }

  const vigenciaHasta = resolveVigencia(params.vigenciaHasta)
  if (vigenciaHasta) {
    const now = new Date()
    if (vigenciaHasta.getTime() < now.getTime()) {
      throw createAnticipoWorkflowError(
        400,
        'VIGENCIA_INVALIDA',
        'La vigencia del anticipo no puede estar en el pasado'
      )
    }
    if (contrato.fechaInicio && vigenciaHasta.getTime() < new Date(contrato.fechaInicio).getTime()) {
      throw createAnticipoWorkflowError(
        400,
        'VIGENCIA_FUERA_DE_CONTRATO',
        'La vigencia del anticipo no puede ser anterior al inicio del contrato'
      )
    }
    if (contrato.fechaFin && vigenciaHasta.getTime() > new Date(contrato.fechaFin).getTime()) {
      throw createAnticipoWorkflowError(
        400,
        'VIGENCIA_FUERA_DE_CONTRATO',
        'La vigencia del anticipo no puede exceder la fecha fin del contrato'
      )
    }
  }
  const monto = Number(params.monto)

  const anticipo = await tx.anticipo.create({
    data: {
      tenantId: params.tenantId,
      tipo: params.tipo,
      contratoId: params.contratoId,
      proveedorId: params.proveedorId || null,
      clienteId: params.clienteId || null,
      montoOriginal: monto,
      montoFinanciado: 0,
      saldoDisponible: 0,
      moneda: params.moneda || 'CUP',
      cuentaOrigenId: params.cuentaOrigenId || null,
      tipoPagoOrigenId: params.tipoPagoOrigenId || null,
      referenciaExterna: params.referenciaExterna || null,
      vigenciaHasta,
      createdById: params.usuarioId
    }
  })

  await tx.anticipoMovimiento.create({
    data: {
      anticipoId: anticipo.anticipoId,
      tipoMovimiento: 'CREACION_RESERVA',
      monto: monto,
      moneda: anticipo.moneda,
      saldoAntes: 0,
      saldoDespues: 0,
      usuarioId: params.usuarioId
    }
  })

  return anticipo
}

/**
 * @description Registra una recepción/entrega parcial de fondos del anticipo,
 * actualiza tesorería y emite el asiento formal dentro de la misma transacción.
 * @param {Prisma.TransactionClient} tx - Transacción activa de Prisma.
 * @param {object} params - Anticipo, cuenta, tipo de pago, monto y actor.
 * @returns {Promise<{movimientoId: string; saldoDisponible: number}>} Movimiento y saldo financiado.
 */
export async function registrarMovimientoEfectivoAnticipo(
  tx: Prisma.TransactionClient,
  params: {
    anticipoId: string
    tenantId: string
    cuentaId: string
    tipoPagoId: string
    monto: number
    idempotencyKey: string
    usuarioId: string
    observaciones?: string
  },
): Promise<{ movimientoId: string; saldoDisponible: number; idempotentReplay: boolean }> {
  if (!Number.isFinite(params.monto) || params.monto <= 0) {
    throw createAnticipoWorkflowError(400, 'MONTO_INVALIDO', 'El monto debe ser mayor que cero')
  }
  if (!params.idempotencyKey.trim()) {
    throw createAnticipoWorkflowError(400, 'IDEMPOTENCY_KEY_REQUERIDA', 'La clave de idempotencia es obligatoria')
  }

  const anticipo = await tx.anticipo.findFirst({
    where: { anticipoId: params.anticipoId, tenantId: params.tenantId },
    select: {
      anticipoId: true,
      tenantId: true,
      tipo: true,
      estado: true,
      montoOriginal: true,
      montoFinanciado: true,
      saldoDisponible: true,
      moneda: true,
      referenciaExterna: true,
    },
  })
  if (!anticipo) throw createAnticipoWorkflowError(404, 'ANTICIPO_NO_ENCONTRADO', 'Anticipo no encontrado')

  const existente = await tx.anticipoMovimiento.findFirst({
    where: { anticipoId: params.anticipoId, idempotencyKey: params.idempotencyKey },
    select: { movimientoId: true, monto: true, saldoDespues: true, cuentaId: true, tipoPagoId: true },
  })
  if (existente) {
    if (
      Number(existente.monto) !== params.monto ||
      existente.cuentaId !== params.cuentaId ||
      existente.tipoPagoId !== params.tipoPagoId
    ) {
      throw createAnticipoWorkflowError(409, 'IDEMPOTENCIA_CONFLICTO', 'La clave ya se usó con otros datos')
    }
    return {
      movimientoId: existente.movimientoId,
      saldoDisponible: Number(existente.saldoDespues),
      idempotentReplay: true,
    }
  }

  if (anticipo.estado !== 'RESERVADO' || anticipo.referenciaExterna?.startsWith('NC:')) {
    throw createAnticipoWorkflowError(409, 'ANTICIPO_NO_FINANCIABLE', 'Este anticipo no admite financiación de efectivo')
  }
  if (Number(anticipo.saldoDisponible) > 0 && Number(anticipo.montoFinanciado) === 0) {
    throw createAnticipoWorkflowError(
      409,
      'SALDO_LEGADO_NO_FINANCIADO',
      'Este anticipo tiene saldo anterior sin evidencia de financiación; requiere conciliación manual',
    )
  }
  if (Number(anticipo.montoFinanciado) + params.monto > Number(anticipo.montoOriginal) + 0.000001) {
    throw createAnticipoWorkflowError(409, 'MONTO_EXCEDE_RESERVA', 'La financiación supera el monto reservado')
  }

  const [cuenta, tipoPago, policy] = await Promise.all([
    tx.cuentaBancaria.findFirst({
      where: { cuentaId: params.cuentaId, tenantId: params.tenantId, isActive: true },
      select: { cuentaId: true, moneda: true, tipoCuenta: true },
    }),
    tx.tipoPago.findFirst({
      where: { tipoId: params.tipoPagoId, tenantId: params.tenantId, isActive: true },
      select: { tipoId: true },
    }),
    tx.tenantAccountingPolicy.findUnique({
      where: { tenantId: params.tenantId },
      select: { functionalCurrencyCode: true },
    }),
  ])
  if (!cuenta) throw createAnticipoWorkflowError(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta activa no encontrada')
  if (!tipoPago) throw createAnticipoWorkflowError(404, 'TIPO_PAGO_NO_ENCONTRADO', 'Tipo de pago activo no encontrado')
  if (cuenta.moneda.trim().toUpperCase() !== anticipo.moneda.trim().toUpperCase()) {
    throw createAnticipoWorkflowError(409, 'MONEDA_CUENTA_INCOMPATIBLE', 'La moneda de la cuenta debe coincidir con la del anticipo')
  }

  const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() || 'CUP'
  const moneda = anticipo.moneda.trim().toUpperCase()
  let tasaCambio: number | null = null
  let montoFuncional = params.monto
  let tasaId: string | null = null
  if (moneda !== monedaFuncional) {
    const tasa = await exchangeRateProvider.getRateAsOf({
      sourceCurrency: moneda,
      targetCurrency: monedaFuncional,
      boundaryAt: new Date(),
      client: tx,
    })
    if (!tasa) throw createAnticipoWorkflowError(409, 'TASA_INVALIDA', `No hay tasa vigente ${moneda} → ${monedaFuncional}`)
    tasaCambio = tasa.tasa
    tasaId = tasa.tasaId
    montoFuncional = params.monto * tasa.tasa
  }

  const saldoAntes = Number(anticipo.saldoDisponible)
  const nuevoSaldo = saldoAntes + params.monto
  const update = await tx.anticipo.updateMany({
    where: {
      anticipoId: anticipo.anticipoId,
      tenantId: params.tenantId,
      estado: 'RESERVADO',
      montoFinanciado: anticipo.montoFinanciado,
      saldoDisponible: anticipo.saldoDisponible,
    },
    data: {
      montoFinanciado: { increment: params.monto },
      saldoDisponible: { increment: params.monto },
    },
  })
  if (update.count !== 1) {
    throw createAnticipoWorkflowError(409, 'CONCURRENCIA', 'El anticipo cambió durante la financiación')
  }

  const cuentaUpdate = await tx.cuentaBancaria.updateMany({
    where: {
      cuentaId: cuenta.cuentaId,
      tenantId: params.tenantId,
      isActive: true,
      ...(anticipo.tipo === 'PAGO' ? { saldo: { gte: params.monto } } : {}),
    },
    data: { saldo: anticipo.tipo === 'COBRO' ? { increment: params.monto } : { decrement: params.monto } },
  })
  if (cuentaUpdate.count !== 1) {
    throw createAnticipoWorkflowError(
      409,
      anticipo.tipo === 'PAGO' ? 'SALDO_CUENTA_INSUFICIENTE' : 'CUENTA_MODIFICADA',
      anticipo.tipo === 'PAGO'
        ? 'La cuenta no tiene saldo suficiente para entregar el anticipo'
        : 'La cuenta cambió durante la financiación',
    )
  }

  const fxEvidenceFingerprint = tasaId
    ? createHash('sha256').update(`${tasaId}:${moneda}:${monedaFuncional}:${tasaCambio}`).digest('hex')
    : null
  const movimiento = await tx.anticipoMovimiento.create({
    data: {
      anticipoId: anticipo.anticipoId,
      tipoMovimiento: anticipo.tipo === 'COBRO' ? 'RECEPCION' : 'ENTREGA',
      cuentaId: cuenta.cuentaId,
      tipoPagoId: tipoPago.tipoId,
      monto: params.monto,
      moneda,
      tasaAplicada: tasaCambio,
      montoConvertido: tasaCambio === null ? null : montoFuncional,
      montoFuncional,
      functionalCurrency: monedaFuncional,
      fxEvidenceFingerprint,
      saldoAntes,
      saldoDespues: nuevoSaldo,
      usuarioId: params.usuarioId,
      idempotencyKey: params.idempotencyKey,
      observaciones: params.observaciones || null,
    },
  })

  await emitirEventoAnticipo(tx, { tenantId: params.tenantId, userId: params.usuarioId }, {
    anticipoMovimientoId: movimiento.movimientoId,
    tipo: anticipo.tipo === 'COBRO' ? 'ANTICIPO_CLIENTE_RECIBIDO' : 'ANTICIPO_PROVEEDOR_ENTREGADO',
    fecha: new Date(),
    monto: params.monto,
    moneda,
    montoFuncional,
    monedaFuncional,
    tasaCambio,
    fxEvidenceFingerprint,
    treasuryAccountType: cuenta.tipoCuenta,
  })

  return { movimientoId: movimiento.movimientoId, saldoDisponible: nuevoSaldo, idempotentReplay: false }
}

export async function executeAnticipo(
  _tx: Prisma.TransactionClient,
  _params: ExecuteAnticipoParams
): Promise<ExecuteAnticipoResult> {
  throw createAnticipoWorkflowError(
    409,
    'APLICACION_DOCUMENTAL_REQUERIDA',
    'Aplique el anticipo desde el flujo transaccional del documento comercial',
  )
}

export async function reverseAnticipo(
  tx: Prisma.TransactionClient,
  params: ReverseAnticipoParams
) {
  if (!Number.isFinite(params.montoReverso) || params.montoReverso <= 0) {
    throw createAnticipoWorkflowError(
      400,
      'MONTO_REVERSO_INVALIDO',
      'El monto de reverso debe ser mayor que cero'
    )
  }
  const idempotencyKey = params.idempotencyKey?.trim()
    || `legacy:${params.documentoDestinoId}:${params.montoReverso}`

  const anticipo = await tx.anticipo.findFirst({
    where: { anticipoId: params.anticipoId, tenantId: params.tenantId },
    select: {
      anticipoId: true,
      tenantId: true,
      tipo: true,
      estado: true,
      montoOriginal: true,
      montoFinanciado: true,
      saldoDisponible: true,
      moneda: true,
      referenciaExterna: true,
    },
  })
  if (!anticipo) {
    throw createAnticipoWorkflowError(404, 'ANTICIPO_NO_ENCONTRADO', 'Anticipo no encontrado')
  }
  const movimientoExistente = await tx.anticipoMovimiento.findFirst({
    where: { anticipoId: anticipo.anticipoId, idempotencyKey },
    select: {
      movimientoId: true,
      tipoMovimiento: true,
      documentoDestinoId: true,
      monto: true,
      saldoDespues: true,
    },
  })
  if (movimientoExistente) {
    if (
      movimientoExistente.tipoMovimiento !== 'REVERSO' ||
      movimientoExistente.documentoDestinoId !== params.documentoDestinoId ||
      Number(movimientoExistente.monto) !== params.montoReverso
    ) {
      throw createAnticipoWorkflowError(409, 'IDEMPOTENCIA_CONFLICTO', 'La clave ya se usó con otros datos')
    }
    return {
      anticipoId: anticipo.anticipoId,
      estado: anticipo.estado,
      saldoDisponible: Number(movimientoExistente.saldoDespues),
      movimientoId: movimientoExistente.movimientoId,
      idempotentReplay: true,
    }
  }
  if (anticipo.estado === 'ANULADO') {
    throw createAnticipoWorkflowError(409, 'ANTICIPO_ANULADO', 'No es posible revertir un anticipo anulado')
  }

  const aplicaciones = await tx.anticipoMovimiento.findMany({
    where: {
      anticipoId: anticipo.anticipoId,
      documentoDestinoId: params.documentoDestinoId,
      tipoMovimiento: 'EJECUCION',
    },
    select: {
      movimientoId: true,
      tipoMovimiento: true,
      contexto: true,
      monto: true,
      montoFuncional: true,
      functionalCurrency: true,
      tasaAplicada: true,
      fxEvidenceFingerprint: true,
    },
  })
  const reversosPrevios = await tx.anticipoMovimiento.findMany({
    where: {
      anticipoId: anticipo.anticipoId,
      documentoDestinoId: params.documentoDestinoId,
      tipoMovimiento: 'REVERSO',
    },
    select: { monto: true, montoFuncional: true, fxEvidenceFingerprint: true },
  })
  const montoAplicado = aplicaciones.reduce((total, movimiento) => total + Number(movimiento.monto), 0)
  const montoReversado = reversosPrevios.reduce((total, movimiento) => total + Number(movimiento.monto), 0)
  const montoPendienteReverso = montoAplicado - montoReversado
  if (montoPendienteReverso <= 0.000001 || params.montoReverso > montoPendienteReverso + 0.000001) {
    throw createAnticipoWorkflowError(
      409,
      'MONTO_REVERSO_EXCEDE_APLICACION',
      'El reverso supera el monto de aplicación pendiente del documento',
    )
  }

  const esNotaCredito = anticipo.referenciaExterna?.startsWith('NC:') ?? false
  const saldoAntes = Number(anticipo.saldoDisponible)
  const saldoRepuesto = saldoAntes + params.montoReverso
  const limiteSaldo = esNotaCredito ? Number(anticipo.montoOriginal) : Number(anticipo.montoFinanciado)
  if (saldoRepuesto > limiteSaldo + 0.000001) {
    throw createAnticipoWorkflowError(409, 'SALDO_REVERSO_EXCEDE_FINANCIACION', 'El reverso excede los fondos disponibles')
  }
  const estadoRepuesto = saldoRepuesto >= Number(anticipo.montoOriginal) - 0.000001
    ? 'RESERVADO'
    : anticipo.estado
  const actualizacion = await tx.anticipo.updateMany({
    where: {
      anticipoId: anticipo.anticipoId,
      tenantId: params.tenantId,
      saldoDisponible: anticipo.saldoDisponible,
      estado: { not: 'ANULADO' },
    },
    data: {
      saldoDisponible: { increment: params.montoReverso },
      estado: estadoRepuesto,
      ...(estadoRepuesto === 'RESERVADO' ? { fechaEjecucion: null } : {}),
    },
  })
  if (actualizacion.count !== 1) {
    throw createAnticipoWorkflowError(409, 'ANTICIPO_CAMBIO_CONCURRENTE', 'El anticipo cambió; vuelve a intentar')
  }

  const monedaFuncionalReferencia = aplicaciones.find((movimiento) => movimiento.functionalCurrency)
    ?.functionalCurrency ?? anticipo.moneda
  let montoFuncional: number | null = null
  let monedaFuncional: string | null = null
  let tasaAplicada: number | null = null
  let fxEvidenceFingerprint: string | null = null
  if (!esNotaCredito) {
    const monedasFuncionales = new Set(
      aplicaciones
        .map((movimiento) => movimiento.functionalCurrency?.trim().toUpperCase())
        .filter((moneda): moneda is string => Boolean(moneda)),
    )
    if (
      monedasFuncionales.size > 1 ||
      aplicaciones.some((movimiento) => movimiento.montoFuncional == null || !movimiento.functionalCurrency) ||
      reversosPrevios.some((movimiento) => movimiento.montoFuncional == null) ||
      (anticipo.moneda.trim().toUpperCase() !== monedaFuncionalReferencia.trim().toUpperCase()
        && aplicaciones.some((movimiento) => !movimiento.fxEvidenceFingerprint))
    ) {
      throw createAnticipoWorkflowError(
        409,
        'VALORACION_FONDOS_INCOMPLETA',
        'No hay valoración funcional o evidencia FX suficiente para compensar la aplicación',
      )
    }
    const valorAplicado = aplicaciones.reduce(
      (total, movimiento) => total + Number(movimiento.montoFuncional ?? 0),
      0,
    )
    const valorReversado = reversosPrevios.reduce(
      (total, movimiento) => total + Number(movimiento.montoFuncional ?? 0),
      0,
    )
    const valorPendienteReverso = valorAplicado - valorReversado
    if (montoPendienteReverso <= 0 || valorPendienteReverso <= 0) {
      throw createAnticipoWorkflowError(
        409,
        'VALORACION_FONDOS_INCOMPLETA',
        'No hay valoración funcional persistida para compensar la aplicación',
      )
    }
    montoFuncional = params.montoReverso * valorPendienteReverso / montoPendienteReverso
    monedaFuncional = monedaFuncionalReferencia
    tasaAplicada = anticipo.moneda.trim().toUpperCase() === monedaFuncional.trim().toUpperCase()
      ? null
      : valorPendienteReverso / montoPendienteReverso
    const huellas = [
      ...aplicaciones.map((movimiento) => movimiento.fxEvidenceFingerprint),
      ...reversosPrevios.map((movimiento) => movimiento.fxEvidenceFingerprint),
    ].filter((fingerprint): fingerprint is string => Boolean(fingerprint)).sort()
    fxEvidenceFingerprint = huellas.length
      ? createHash('sha256').update(huellas.join(':')).digest('hex')
      : null
  }

  const movimiento = await tx.anticipoMovimiento.create({
    data: {
      anticipoId: anticipo.anticipoId,
      tipoMovimiento: 'REVERSO',
      contexto: aplicaciones[0]?.contexto ?? null,
      documentoDestinoId: params.documentoDestinoId,
      monto: params.montoReverso,
      moneda: anticipo.moneda,
      montoConvertido: montoFuncional,
      montoFuncional,
      functionalCurrency: monedaFuncional,
      tasaAplicada,
      fxEvidenceFingerprint,
      saldoAntes,
      saldoDespues: saldoRepuesto,
      usuarioId: params.usuarioId,
      observaciones: params.observaciones || null,
    },
  })

  if (!esNotaCredito && montoFuncional !== null && monedaFuncional) {
    await emitirEventoAnticipo(tx, { tenantId: params.tenantId, userId: params.usuarioId }, {
      anticipoMovimientoId: movimiento.movimientoId,
      tipo: anticipo.tipo === 'COBRO'
        ? 'ANTICIPO_CLIENTE_APLICACION_REVERSADA'
        : 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA',
      fecha: new Date(),
      monto: params.montoReverso,
      moneda: anticipo.moneda,
      montoFuncional,
      monedaFuncional,
      tasaCambio: tasaAplicada,
      fxEvidenceFingerprint,
      descripcion: 'Reverso de aplicación por eliminación del documento',
    })
  }

  return {
    anticipoId: anticipo.anticipoId,
    estado: estadoRepuesto,
    saldoDisponible: saldoRepuesto,
    movimientoId: movimiento.movimientoId,
    idempotentReplay: false,
  }
}

/**
 * @description Aplica una o varias allocations de anticipo a un documento.
 * Valida ownership, saldo y moneda; luego descuenta cada anticipo y crea los movimientos.
 * @param {Prisma.TransactionClient} tx - Transaction client de Prisma.
 * @param {AnticipoAllocation[]} allocations - Lista de allocations (anticipoId + montoAplicado).
 * @param {Object} context - Contexto del documento destino.
 * @param {string} context.documentoDestinoId - ID del documento (compra servicio, venta servicio, etc).
 * @param {AnticipoContexto} context.contexto - Tipo de contexto del anticipo.
 * @param {string} context.usuarioId - ID del usuario que ejecuta.
 * @param {string} [context.idempotencyKey] - Clave de idempotencia (una por documento, no por anticipo).
 * @param {string} [context.observaciones] - Observaciones opcionales.
 * @returns {Promise<AnticipoAllocationResult[]>} Lista de resultados por cada allocation aplicada.
 */
export async function applyAnticipoAllocations(
  tx: Prisma.TransactionClient,
  allocations: AnticipoAllocation[],
  context: {
    tenantId: string
    documentoDestinoId: string
    contexto: AnticipoContexto
    usuarioId: string
    idempotencyKey?: string
    observaciones?: string
  }
): Promise<AnticipoAllocationResult[]> {
  if (!allocations || allocations.length === 0) {
    return []
  }

  const results: AnticipoAllocationResult[] = []

  for (const allocation of allocations) {
    const { anticipoId, montoAplicado } = allocation

    if (!Number.isFinite(montoAplicado) || montoAplicado <= 0) {
      throw createAnticipoWorkflowError(
        400,
        'MONTO_APLICADO_INVALIDO',
        `El monto aplicado para el anticipo ${anticipoId} debe ser mayor que cero`
      )
    }

    // Cargar anticipo con validaciones
    const anticipo = await tx.anticipo.findFirst({
      where: { anticipoId, tenantId: context.tenantId },
      select: {
        anticipoId: true,
        tipo: true,
        estado: true,
        montoOriginal: true,
        montoFinanciado: true,
        saldoDisponible: true,
        moneda: true,
        vigenciaHasta: true,
        proveedorId: true,
        clienteId: true,
        cuentaOrigenId: true,
        referenciaExterna: true,
      },
    })

    if (!anticipo) {
      throw createAnticipoWorkflowError(404, 'ANTICIPO_NO_ENCONTRADO', `Anticipo ${anticipoId} no encontrado`)
    }

    if (anticipo.estado !== 'RESERVADO') {
      throw createAnticipoWorkflowError(
        409,
        'ANTICIPO_NO_ELEGIBLE',
        `El anticipo ${anticipoId} no está en estado reservado (estado: ${anticipo.estado})`
      )
    }

    if (anticipo.vigenciaHasta && new Date(anticipo.vigenciaHasta).getTime() < Date.now()) {
      throw createAnticipoWorkflowError(409, 'ANTICIPO_VENCIDO', `El anticipo ${anticipoId} está vencido`)
    }

    const saldoDisponible = Number(anticipo.saldoDisponible)
    if (saldoDisponible + 0.000001 < montoAplicado) {
      throw createAnticipoWorkflowError(
        409,
        'COBERTURA_INSUFICIENTE',
        `El anticipo ${anticipoId} tiene saldo ${saldoDisponible} pero se intenta aplicar ${montoAplicado}`
      )
    }

    const esSaldoNotaCredito = anticipo.referenciaExterna?.startsWith('NC:') ?? false
    if (!esSaldoNotaCredito && Number(anticipo.montoFinanciado) <= 0) {
      throw createAnticipoWorkflowError(
        409,
        'ANTICIPO_SIN_FONDOS_REALES',
        `El anticipo ${anticipoId} no tiene fondos recibidos o entregados registrados`,
      )
    }

    let valorFuncionalAplicado: number | null = null
    let monedaFuncional: string | null = null
    let tasaPromedio: number | null = null
    let fxEvidenceFingerprint: string | null = null
    if (!esSaldoNotaCredito) {
      const movimientosValorados = await tx.anticipoMovimiento.findMany({
        where: { anticipoId, tipoMovimiento: { in: ['RECEPCION', 'ENTREGA', 'EJECUCION'] } },
        select: {
          tipoMovimiento: true,
          monto: true,
          montoFuncional: true,
          tasaAplicada: true,
          functionalCurrency: true,
          fxEvidenceFingerprint: true,
        },
        orderBy: { createdAt: 'asc' },
      })
      const financiaciones = movimientosValorados.filter((movimiento) =>
        movimiento.tipoMovimiento === 'RECEPCION' || movimiento.tipoMovimiento === 'ENTREGA',
      )
      const aplicacionesPrevias = movimientosValorados.filter((movimiento) =>
        movimiento.tipoMovimiento === 'EJECUCION',
      )
      const montoFinanciado = financiaciones.reduce((total, movimiento) => total + Number(movimiento.monto), 0)
      const valorFinanciado = financiaciones.reduce(
        (total, movimiento) => total + Number(movimiento.montoFuncional ?? movimiento.monto),
        0,
      )
      const montoAplicadoPreviamente = aplicacionesPrevias.reduce((total, movimiento) => total + Number(movimiento.monto), 0)
      const valorAplicadoPreviamente = aplicacionesPrevias.reduce(
        (total, movimiento) => total + Number(movimiento.montoFuncional ?? movimiento.monto),
        0,
      )
      const saldoFinanciado = montoFinanciado - montoAplicadoPreviamente
      const saldoValorado = valorFinanciado - valorAplicadoPreviamente
      if (saldoFinanciado + 0.000001 < montoAplicado || saldoFinanciado <= 0) {
        throw createAnticipoWorkflowError(409, 'VALORACION_FONDOS_INCOMPLETA', 'No hay valoración persistida suficiente para aplicar el anticipo')
      }
      valorFuncionalAplicado = montoAplicado * saldoValorado / saldoFinanciado
      monedaFuncional = financiaciones.find((movimiento) => movimiento.functionalCurrency)?.functionalCurrency ?? anticipo.moneda
      tasaPromedio = anticipo.moneda.trim().toUpperCase() === monedaFuncional.trim().toUpperCase()
        ? null
        : valorFinanciado / montoFinanciado
      const huellas = financiaciones
        .map((movimiento) => movimiento.fxEvidenceFingerprint)
        .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
        .sort()
      fxEvidenceFingerprint = huellas.length
        ? createHash('sha256').update(huellas.join(':')).digest('hex')
        : null
    }

    // El decremento condicional evita tanto acceso cruzado entre tenants como
    // el lost update de dos aplicaciones concurrentes sobre el mismo anticipo.
    const applied = await tx.anticipo.updateMany({
      where: {
        anticipoId,
        tenantId: context.tenantId,
        estado: 'RESERVADO',
        saldoDisponible: { gte: montoAplicado },
      },
      data: {
        saldoDisponible: { decrement: montoAplicado },
      },
    })
    if (applied.count !== 1) {
      throw createAnticipoWorkflowError(
        409,
        'COBERTURA_INSUFICIENTE',
        `El anticipo ${anticipoId} cambió o ya no tiene saldo suficiente`
      )
    }

    const actualizado = await tx.anticipo.findFirst({
      where: { anticipoId, tenantId: context.tenantId },
      select: { saldoDisponible: true },
    })
    const nuevoSaldo = Number(actualizado?.saldoDisponible ?? 0)
    const anticipoTotalmenteConsumido = nuevoSaldo <= 0.000001 &&
      Number(anticipo.montoFinanciado) >= Number(anticipo.montoOriginal) - 0.000001
    if (anticipoTotalmenteConsumido) {
      await tx.anticipo.updateMany({
        where: { anticipoId, tenantId: context.tenantId },
        data: { estado: 'EJECUTADO', fechaEjecucion: new Date() },
      })
    }

    // Crear movimiento de aplicación
    const movimiento = await tx.anticipoMovimiento.create({
      data: {
        anticipoId,
        tipoMovimiento: 'EJECUCION',
        contexto: context.contexto,
        documentoDestinoId: context.documentoDestinoId,
        monto: montoAplicado,
        moneda: anticipo.moneda,
        montoFuncional: valorFuncionalAplicado,
        functionalCurrency: monedaFuncional,
        tasaAplicada: tasaPromedio,
        fxEvidenceFingerprint,
        saldoAntes: nuevoSaldo + montoAplicado,
        saldoDespues: nuevoSaldo,
        usuarioId: context.usuarioId,
        idempotencyKey: context.idempotencyKey
          ? `${context.idempotencyKey}:${anticipoId}`
          : undefined,
        observaciones: context.observaciones || null,
      },
    })

    if (!esSaldoNotaCredito && valorFuncionalAplicado !== null && monedaFuncional) {
      await emitirEventoAnticipo(tx, { tenantId: context.tenantId, userId: context.usuarioId }, {
        anticipoMovimientoId: movimiento.movimientoId,
        tipo: anticipo.tipo === 'COBRO' ? 'ANTICIPO_CLIENTE_APLICADO' : 'ANTICIPO_PROVEEDOR_APLICADO',
        fecha: new Date(),
        monto: montoAplicado,
        moneda: anticipo.moneda,
        montoFuncional: valorFuncionalAplicado,
        monedaFuncional,
        tasaCambio: tasaPromedio,
        fxEvidenceFingerprint,
      })
    }

    results.push({
      anticipoId,
      movimientoId: movimiento.movimientoId,
      montoAplicado,
      saldoRestante: nuevoSaldo,
    })
  }

  return results
}

/**
 * @description Crea un saldo a favor del cliente como anticipo COBRO sin contrato
 * (DNC): nace del excedente de una nota de crédito. El movimiento inicial lleva
 * contexto NOTA_CREDITO y una clave de idempotencia ligada a la devolución.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {object} params - tenantId, clienteId, monto (centavos), moneda,
 * facturaId de la NC (opcional), devolucionId y usuarioId.
 * @returns {Promise<object>} El anticipo creado.
 */
export async function createAnticipoDevolucion(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    clienteId: string | null
    monto: number
    moneda?: string
    facturaId?: string | null
    devolucionId: string
    usuarioId: string
  }
) {
  if (!params.clienteId) {
    throw createAnticipoWorkflowError(
      400,
      'CLIENTE_REQUERIDO',
      'Para el saldo a favor se requiere cliente'
    )
  }

  if (!Number.isFinite(params.monto) || params.monto <= 0) {
    throw createAnticipoWorkflowError(400, 'MONTO_INVALIDO', 'El monto debe ser mayor que cero')
  }

  const anticipo = await tx.anticipo.create({
    data: {
      tenantId: params.tenantId,
      tipo: 'COBRO',
      contratoId: null,
      clienteId: params.clienteId,
      facturaId: params.facturaId || null,
      montoOriginal: params.monto,
      saldoDisponible: params.monto,
      moneda: params.moneda || 'CUP',
      referenciaExterna: `NC:${params.devolucionId}`,
      createdById: params.usuarioId
    }
  })

  await tx.anticipoMovimiento.create({
    data: {
      anticipoId: anticipo.anticipoId,
      tipoMovimiento: 'CREACION_RESERVA',
      contexto: 'NOTA_CREDITO',
      documentoDestinoId: params.facturaId || null,
      monto: params.monto,
      moneda: anticipo.moneda,
      saldoAntes: 0,
      saldoDespues: params.monto,
      usuarioId: params.usuarioId,
      idempotencyKey: `DNC-${params.devolucionId}`
    }
  })

  return anticipo
}
