import { Prisma } from '@/generated/prisma'
import { createHash } from 'node:crypto'
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine'
import { buildEventoAnticipoAplicado, buildEventoAnticipoCreado } from '@/features/contabilidad-formal/lib/event-builders'
import { valueAnticipo, valueAnticipoApplication, anticipoEventValuation } from '@/lib/services/anticipo-valuation'
import { AuditLogService } from '@/lib/services/audit-log-service'
import {
  AnticipoWorkflowError,
  AnticipoContexto,
  CreateAnticipoParams,
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

  const creationKey = params.idempotencyKey?.trim() || null
  const creationHash = creationKey ? createHash('sha256').update(JSON.stringify([
    params.tipo, params.contratoId, params.proveedorId ?? null, params.clienteId ?? null,
    new Prisma.Decimal(params.monto).toString(), params.moneda.trim().toUpperCase(),
    params.cuentaOrigenId ?? null, params.tipoPagoOrigenId ?? null,
    params.referenciaExterna ?? null,
    params.vigenciaHasta ? new Date(params.vigenciaHasta).toISOString() : null,
  ])).digest('hex') : null
  if (creationKey) {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(
      ${`anticipo:${params.tenantId}:${creationKey}`}, 0))`
    const prior = await tx.anticipo.findFirst({ where: {
      tenantId: params.tenantId, creationKey,
    } })
    if (prior) {
      if (prior.creationHash !== creationHash) {
        throw createAnticipoWorkflowError(409, 'IDEMPOTENCY_CONFLICT',
          'La clave de creación ya se utilizó con otros datos')
      }
      return prior
    }
  }

  const contrato = await tx.contrato.findUnique({
    where: { contratoId: params.contratoId, tenantId: params.tenantId },
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
  const snapshot = await valueAnticipo(tx, params.tenantId, new Prisma.Decimal(monto), params.moneda)
  const valoracion = anticipoEventValuation(snapshot)
  if (!params.cuentaOrigenId || !params.tipoPagoOrigenId) {
    throw createAnticipoWorkflowError(400, 'FONDOS_REQUERIDOS',
      'El anticipo recibido o entregado requiere cuenta bancaria y tipo de pago')
  }
  const [cuenta, tipoPago] = await Promise.all([
    tx.cuentaBancaria.findFirst({ where: {
      cuentaId: params.cuentaOrigenId, tenantId: params.tenantId, isActive: true,
    } }),
    tx.tipoPago.findFirst({ where: {
      tipoId: params.tipoPagoOrigenId, tenantId: params.tenantId, isActive: true,
    } }),
  ])
  if (!cuenta || !tipoPago) {
    throw createAnticipoWorkflowError(404, 'FONDOS_NO_ENCONTRADOS',
      'La cuenta o el tipo de pago no pertenece al tenant')
  }
  const monedaCuenta = cuenta.moneda.trim().toUpperCase()
  const importeCuenta = monedaCuenta === snapshot.originalCurrency
    ? new Prisma.Decimal(snapshot.originalAmount)
    : monedaCuenta === snapshot.functionalCurrency
      ? new Prisma.Decimal(snapshot.functionalAmount) : null
  if (!importeCuenta) {
    throw createAnticipoWorkflowError(400, 'FX_INSUFICIENTE',
      'La moneda de la cuenta no es compatible con la valoración del anticipo')
  }
  const fondos = await tx.cuentaBancaria.updateMany({
    where: {
      cuentaId: cuenta.cuentaId, tenantId: params.tenantId, isActive: true,
      ...(params.tipo === 'PAGO' ? { saldo: { gte: importeCuenta.toNumber() } } : {}),
    },
    data: { saldo: params.tipo === 'PAGO'
      ? { decrement: importeCuenta.toNumber() } : { increment: importeCuenta.toNumber() } },
  })
  if (fondos.count !== 1) {
    throw createAnticipoWorkflowError(409, 'SALDO_INSUFICIENTE',
      'La cuenta no está disponible o no conserva saldo suficiente')
  }

  const anticipo = await tx.anticipo.create({
    data: {
      tenantId: params.tenantId,
      tipo: params.tipo,
      contratoId: params.contratoId,
      proveedorId: params.proveedorId || null,
      clienteId: params.clienteId || null,
      montoOriginal: monto,
      fxSnapshot: snapshot,
      creationKey,
      creationHash,
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
      fxSnapshot: snapshot,
      tasaAplicada: snapshot.exchangeRate,
      montoConvertido: snapshot.functionalAmount,
      moneda: anticipo.moneda,
      saldoAntes: 0,
      saldoDespues: monto,
      usuarioId: params.usuarioId
    }
  })

  // Capa de contabilidad formal (CTA-1): el anticipo documenta el pasivo
  // (cliente) o el activo (proveedor) contra la tesorería.
  await postEvento(
    tx,
    { tenantId: params.tenantId, userId: params.usuarioId },
    buildEventoAnticipoCreado({
      anticipoId: anticipo.anticipoId,
      tipo: params.tipo,
      valoracion,
      tipoCuenta: cuenta.tipoCuenta,
      descripcion: params.referenciaExterna ?? undefined,
    }),
  )

  await AuditLogService.logStrict({
    accion: 'CREATE',
    entidad: 'ANTICIPO',
    entidadId: anticipo.anticipoId,
    usuarioId: params.usuarioId,
    detalles: {
      tipo: anticipo.tipo,
      monto: Number(anticipo.montoOriginal),
      moneda: anticipo.moneda,
      proveedorId: anticipo.proveedorId,
      clienteId: anticipo.clienteId,
      monedaFuncional: snapshot.functionalCurrency,
      montoFuncional: snapshot.functionalAmount,
    },
  }, tx)

  return anticipo
}

/**
 * @description Writer legacy retirado: las aplicaciones solo ocurren desde el documento consumidor.
 * @param {Prisma.TransactionClient} tx - Parámetro legacy conservado temporalmente para diagnóstico.
 * @param {object} params - Payload legacy de ejecución manual.
 * @returns {Promise<never>} Siempre falla con el gate documental requerido.
 */
export async function executeAnticipo(
  tx: Prisma.TransactionClient,
  params: {
    anticipoId: string;
    contexto: AnticipoContexto;
    documentoDestinoId: string;
    montoObjetivo: number;
    monedaObjetivo: string;
    tasaAplicada?: number;
    idempotencyKey: string;
    observaciones?: string;
    usuarioId: string;
  },
): Promise<never> {
  void tx;
  void params;
  throw createAnticipoWorkflowError(
    409,
    'DOCUMENT_WORKFLOW_REQUIRED',
    'El anticipo se aplica únicamente desde el flujo que crea el documento consumidor',
  );
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
    clienteId?: string
    proveedorId?: string
    monedaDocumento?: string
    monedaFuncionalDocumento?: string
    montoFuncionalDocumento?: Prisma.Decimal | string | number
  }
): Promise<AnticipoAllocationResult[]> {
  if (!allocations || allocations.length === 0) {
    return []
  }

  const results: AnticipoAllocationResult[] = []
  const nominalTotal = new Prisma.Decimal(allocations.reduce(
    (sum, item) => sum.plus(item.montoAplicado), new Prisma.Decimal(0),
  ))
  const functionalTotal = context.montoFuncionalDocumento == null
    ? null
    : new Prisma.Decimal(context.montoFuncionalDocumento)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
  let functionalAllocated = new Prisma.Decimal(0)

  for (const [allocationIndex, allocation] of allocations.entries()) {
    const { anticipoId, montoAplicado } = allocation

    if (!Number.isFinite(montoAplicado) || montoAplicado <= 0) {
      throw createAnticipoWorkflowError(
        400,
        'MONTO_APLICADO_INVALIDO',
        `El monto aplicado para el anticipo ${anticipoId} debe ser mayor que cero`
      )
    }

    await tx.$queryRaw`
      SELECT 1 FROM "Anticipo" WHERE "anticipoId" = ${anticipoId}
        AND "tenantId" = ${context.tenantId} FOR UPDATE
    `
    const applicationKey = `${context.idempotencyKey ??
      `${context.contexto}:${context.documentoDestinoId}`}:${anticipoId}`
    const prior = await tx.anticipoMovimiento.findFirst({ where: {
      anticipoId, idempotencyKey: applicationKey,
      anticipo: { tenantId: context.tenantId },
    } });
    if (prior) {
      if (!new Prisma.Decimal(prior.monto).eq(montoAplicado) ||
        prior.documentoDestinoId !== context.documentoDestinoId ||
        prior.contexto !== context.contexto) {
        throw createAnticipoWorkflowError(409, 'IDEMPOTENCY_CONFLICT',
          'La clave de aplicación ya se utilizó para otro documento o importe')
      }
      results.push({ anticipoId, movimientoId: prior.movimientoId,
        montoAplicado, saldoRestante: Number(prior.saldoDespues) })
      continue
    }

    // Cargar anticipo con validaciones
    const anticipo = await tx.anticipo.findFirst({
      where: { anticipoId, tenantId: context.tenantId },
      select: {
        anticipoId: true,
        tipo: true,
        estado: true,
        saldoDisponible: true,
        moneda: true,
        vigenciaHasta: true,
        proveedorId: true,
        clienteId: true,
        cuentaOrigenId: true,
        montoOriginal: true,
        fxSnapshot: true,
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

    const applicationSnapshot = valueAnticipoApplication(
      anticipo.fxSnapshot, new Prisma.Decimal(anticipo.montoOriginal),
      anticipo.moneda, new Prisma.Decimal(montoAplicado),
    )
    if ((context.clienteId && (anticipo.tipo !== 'COBRO' ||
        anticipo.clienteId !== context.clienteId)) ||
        (context.proveedorId && (anticipo.tipo !== 'PAGO' ||
        anticipo.proveedorId !== context.proveedorId))) {
      throw createAnticipoWorkflowError(409, 'TERCERO_NO_COMPATIBLE',
        'El anticipo no corresponde al cliente o proveedor del documento')
    }
    if ((context.monedaDocumento && context.monedaDocumento.trim().toUpperCase() !==
        applicationSnapshot.originalCurrency) ||
        (context.monedaFuncionalDocumento && context.monedaFuncionalDocumento.trim().toUpperCase() !==
          applicationSnapshot.functionalCurrency)) {
      throw createAnticipoWorkflowError(400, 'FX_INSUFICIENTE',
        'La moneda funcional del anticipo no coincide con el documento reconocido')
    }
    const amountDocumentFunctional = functionalTotal == null
      ? new Prisma.Decimal(applicationSnapshot.functionalAmount)
      : allocationIndex === allocations.length - 1
        ? functionalTotal.minus(functionalAllocated)
        : functionalTotal.mul(montoAplicado).div(nominalTotal)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
    functionalAllocated = functionalAllocated.plus(amountDocumentFunctional)
    const amountAdvanceFunctional = new Prisma.Decimal(applicationSnapshot.functionalAmount)
    const diferenciaFx = anticipo.tipo === 'COBRO'
      ? amountAdvanceFunctional.minus(amountDocumentFunctional)
      : amountDocumentFunctional.minus(amountAdvanceFunctional)

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
    if (nuevoSaldo <= 0.000001) {
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
        fxSnapshot: applicationSnapshot,
        tasaAplicada: applicationSnapshot.exchangeRate,
        montoConvertido: applicationSnapshot.functionalAmount,
        moneda: anticipo.moneda,
        saldoAntes: nuevoSaldo + montoAplicado,
        saldoDespues: nuevoSaldo,
        usuarioId: context.usuarioId,
        idempotencyKey: applicationKey,
        observaciones: context.observaciones || null,
      },
    })

    // Capa de contabilidad formal (CTA-1): aplicación del anticipo al documento.
    // En moneda extranjera la valoración aplicada exige tasa y fingerprint (fila 26).
    const valoracionAplicada = anticipoEventValuation(applicationSnapshot)
    await postEvento(
      tx,
      { tenantId: context.tenantId, userId: context.usuarioId },
      buildEventoAnticipoAplicado({
        movimientoId: movimiento.movimientoId,
        tipo: anticipo.tipo === 'COBRO' ? 'CLIENTE' : 'PROVEEDOR',
        valoracion: valoracionAplicada,
        diferenciaFx,
        referencia: context.documentoDestinoId,
      }),
    )

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
    moneda: string
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

  const moneda = params.moneda?.trim().toUpperCase()
  if (!moneda) {
    throw createAnticipoWorkflowError(
      400,
      'MONEDA_REQUERIDA',
      'Para el saldo a favor se requiere la moneda explícita del documento origen'
    )
  }

  const snapshot = await valueAnticipo(tx, params.tenantId,
    new Prisma.Decimal(params.monto), moneda, 'devolucion-saldo-favor')

  const anticipo = await tx.anticipo.create({
    data: {
      tenantId: params.tenantId,
      tipo: 'COBRO',
      contratoId: null,
      clienteId: params.clienteId,
      facturaId: params.facturaId || null,
      montoOriginal: params.monto,
      fxSnapshot: snapshot,
      saldoDisponible: params.monto,
      moneda: moneda,
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
      fxSnapshot: snapshot,
      tasaAplicada: snapshot.exchangeRate,
      montoConvertido: snapshot.functionalAmount,
      moneda: anticipo.moneda,
      saldoAntes: 0,
      saldoDespues: params.monto,
      usuarioId: params.usuarioId,
      idempotencyKey: `DNC-${params.devolucionId}`
    }
  })

  return anticipo
}
