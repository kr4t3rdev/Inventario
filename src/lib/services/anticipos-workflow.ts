import { Prisma } from '@/generated/prisma'
import { getIdempotentResult, setIdempotentResult } from '@/lib/idempotency'
import {
  AnticipoWorkflowError,
  CreateAnticipoParams,
  ExecuteAnticipoParams,
  ExecuteAnticipoPersistedResult,
  ExecuteAnticipoResult,
  ExecuteReconciliacionHandler,
  ReverseAnticipoParams
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

function buildExecuteFingerprint(params: ExecuteAnticipoParams): string {
  return JSON.stringify({
    anticipoId: params.anticipoId,
    contexto: params.contexto,
    documentoDestinoId: params.documentoDestinoId,
    montoObjetivo: Number(params.montoObjetivo),
    monedaObjetivo: params.monedaObjetivo,
    tasaAplicada: typeof params.tasaAplicada === 'number' ? Number(params.tasaAplicada) : null
  })
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
      tipo: params.tipo,
      contratoId: params.contratoId,
      proveedorId: params.proveedorId || null,
      clienteId: params.clienteId || null,
      montoOriginal: monto,
      saldoDisponible: monto,
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
      saldoDespues: monto,
      usuarioId: params.usuarioId
    }
  })

  return anticipo
}

export async function executeAnticipo(
  tx: Prisma.TransactionClient,
  params: ExecuteAnticipoParams,
  executeReconciliacion: ExecuteReconciliacionHandler
): Promise<ExecuteAnticipoResult> {
  if (!params.idempotencyKey?.trim()) {
    throw createAnticipoWorkflowError(
      400,
      'IDEMPOTENCY_KEY_REQUERIDA',
      'La clave de idempotencia es obligatoria'
    )
  }

  if (!Number.isFinite(params.montoObjetivo) || params.montoObjetivo <= 0) {
    throw createAnticipoWorkflowError(
      400,
      'MONTO_OBJETIVO_INVALIDO',
      'El monto objetivo debe ser mayor que cero'
    )
  }

  const idempotencyCacheKey = `anticipos:execute:${params.anticipoId}:${params.idempotencyKey}`
  const fingerprint = buildExecuteFingerprint(params)
  const persisted = await getIdempotentResult<ExecuteAnticipoPersistedResult>(idempotencyCacheKey)
  if (persisted) {
    if (persisted.requestFingerprint !== fingerprint) {
      throw createAnticipoWorkflowError(
        409,
        'IDEMPOTENCIA_CONFLICTO',
        'La clave de idempotencia ya fue usada con otro payload'
      )
    }
    return {
      ...persisted.response,
      idempotentReplay: true
    }
  }

  const anticipo = await tx.anticipo.findUnique({
      where: { anticipoId: params.anticipoId },
      select: {
        anticipoId: true,
        estado: true,
        saldoDisponible: true,
        moneda: true,
        vigenciaHasta: true
      }
    })

    if (!anticipo) {
      throw createAnticipoWorkflowError(404, 'ANTICIPO_NO_ENCONTRADO', 'Anticipo no encontrado')
    }

    if (anticipo.estado !== 'RESERVADO') {
      throw createAnticipoWorkflowError(
        409,
        'ANTICIPO_NO_ELEGIBLE',
        'El anticipo no está en estado reservado'
      )
    }

    if (
      anticipo.vigenciaHasta &&
      new Date(anticipo.vigenciaHasta).getTime() < Date.now()
    ) {
      throw createAnticipoWorkflowError(409, 'ANTICIPO_VENCIDO', 'El anticipo está vencido')
    }

    const saldoDisponible = Number(anticipo.saldoDisponible)
    const montoObjetivo = Number(params.montoObjetivo)
    if (saldoDisponible + 0.000001 < montoObjetivo) {
      throw createAnticipoWorkflowError(
        409,
        'COBERTURA_INSUFICIENTE',
        'El saldo del anticipo no cubre el monto objetivo'
      )
    }

    if (saldoDisponible - montoObjetivo > 0.000001) {
      throw createAnticipoWorkflowError(
        409,
        'EJECUCION_PARCIAL_NO_PERMITIDA',
        'La ejecución parcial del anticipo no está permitida'
      )
    }

    let montoConvertido: number | null = null
    let tasaAplicada: number | null = null
    if (anticipo.moneda !== params.monedaObjetivo) {
      if (!params.tasaAplicada || !Number.isFinite(params.tasaAplicada) || params.tasaAplicada <= 0) {
        throw createAnticipoWorkflowError(
          409,
          'TASA_INVALIDA',
          'No existe una tasa válida para ejecutar el anticipo en otra moneda'
        )
      }
      tasaAplicada = Number(params.tasaAplicada)
      montoConvertido = montoObjetivo * tasaAplicada
    }

    const nuevoSaldo = saldoDisponible - montoObjetivo
    const now = new Date()
  const updateResult = await tx.anticipo.updateMany({
      where: {
        anticipoId: anticipo.anticipoId,
        estado: 'RESERVADO',
        saldoDisponible: anticipo.saldoDisponible
      },
      data: {
        saldoDisponible: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? 'EJECUTADO' : 'RESERVADO',
        fechaEjecucion: nuevoSaldo <= 0 ? now : null
      }
    })

    if (updateResult.count !== 1) {
      throw createAnticipoWorkflowError(
        409,
        'CONCURRENCIA',
        'El anticipo fue modificado por otra operación concurrente'
      )
    }

  const reconciliacion = await executeReconciliacion(tx)

  const movimiento = await tx.anticipoMovimiento.create({
      data: {
        anticipoId: anticipo.anticipoId,
        tipoMovimiento: 'EJECUCION',
        contexto: params.contexto,
        documentoDestinoId: params.documentoDestinoId,
        reconciliacionVentaId: reconciliacion.reconciliacionVentaId || null,
        reconciliacionGastoId: reconciliacion.reconciliacionGastoId || null,
        monto: montoObjetivo,
        moneda: anticipo.moneda,
        tasaAplicada: tasaAplicada || null,
        montoConvertido: montoConvertido || null,
        saldoAntes: saldoDisponible,
        saldoDespues: nuevoSaldo,
        usuarioId: params.usuarioId,
        idempotencyKey: params.idempotencyKey,
        observaciones: params.observaciones || null
      }
    })

  const estadoFinal: 'EJECUTADO' | 'RESERVADO' = nuevoSaldo <= 0 ? 'EJECUTADO' : 'RESERVADO'
  const result = {
    anticipoId: anticipo.anticipoId,
    estado: estadoFinal,
    saldoDisponible: nuevoSaldo,
    movimientoId: movimiento.movimientoId,
    reconciliacionVentaId: reconciliacion.reconciliacionVentaId,
    reconciliacionGastoId: reconciliacion.reconciliacionGastoId
  }

  await setIdempotentResult<ExecuteAnticipoPersistedResult>(idempotencyCacheKey, {
    requestFingerprint: fingerprint,
    response: result
  })

  return {
    ...result,
    idempotentReplay: false
  }
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

  const anticipo = await tx.anticipo.findUnique({
      where: { anticipoId: params.anticipoId },
      select: {
        anticipoId: true,
        estado: true,
        montoOriginal: true,
        saldoDisponible: true,
        moneda: true
      }
    })

    if (!anticipo) {
      throw createAnticipoWorkflowError(404, 'ANTICIPO_NO_ENCONTRADO', 'Anticipo no encontrado')
    }

    if (anticipo.estado === 'ANULADO') {
      throw createAnticipoWorkflowError(
        409,
        'ANTICIPO_ANULADO',
        'No es posible revertir un anticipo anulado'
      )
    }

    const saldoAntes = Number(anticipo.saldoDisponible)
    const saldoRepuesto = Math.min(
      Number(anticipo.montoOriginal),
      Number(anticipo.saldoDisponible) + Number(params.montoReverso)
    )

    const estadoRepuesto = saldoRepuesto >= Number(anticipo.montoOriginal) ? 'RESERVADO' : anticipo.estado

  await tx.anticipo.update({
      where: { anticipoId: anticipo.anticipoId },
      data: {
        saldoDisponible: saldoRepuesto,
        estado: estadoRepuesto,
        fechaEjecucion: estadoRepuesto === 'RESERVADO' ? null : undefined
      }
    })

  const movimiento = await tx.anticipoMovimiento.create({
      data: {
        anticipoId: anticipo.anticipoId,
        tipoMovimiento: 'REVERSO',
        documentoDestinoId: params.documentoDestinoId,
        monto: Number(params.montoReverso),
        moneda: anticipo.moneda,
        saldoAntes: saldoAntes,
        saldoDespues: saldoRepuesto,
        usuarioId: params.usuarioId,
        observaciones: params.observaciones || null
      }
    })

  return {
    anticipoId: anticipo.anticipoId,
    estado: estadoRepuesto,
    saldoDisponible: saldoRepuesto,
    movimientoId: movimiento.movimientoId
  }
}
