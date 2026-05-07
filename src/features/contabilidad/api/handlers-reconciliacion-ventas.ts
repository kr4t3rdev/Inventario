import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { AuditLogService } from '@/lib/services/audit-log-service'

function normalizeMontoToCup(monto: number, moneda: string, tasaCambio?: number): number {
  if (moneda === 'CUP') return monto
  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) return monto * tasaCambio
  return monto
}

function convertMontoToCuentaMoneda(monto: number, monedaPago: string, monedaCuenta: string, tasaCambio?: number): number {
  if (monedaPago === monedaCuenta) return monto
  if (typeof tasaCambio === 'number' && Number.isFinite(tasaCambio) && tasaCambio > 0) return monto * tasaCambio
  return monto
}

function createReconciliacionError(status: number, code: string, message: string): Error & { status: number; code: string } {
  const error = new Error(message) as Error & { status: number; code: string }
  error.status = status
  error.code = code
  return error
}

function getNumeroFacturaCandidates(ordenId?: string | null, numeroFactura?: string | null): string[] {
  return Array.from(
    new Set([ordenId, numeroFactura].map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v): v is string => v.length > 0))
  )
}

export const reconciliacionVentaSchema = z.object({
  ventaId: z.string().min(1, 'ID de venta es requerido'),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido'),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido'),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  verificacionTransferenciaId: z.string().optional(),
  idTransferencia: z.string().optional(),
  observaciones: z.string().optional()
})

export async function handleGetReconciliacionVentas(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fechaDesde = searchParams.get('fechaDesde') || searchParams.get('fechaInicio')
  const fechaHasta = searchParams.get('fechaHasta') || searchParams.get('fechaFin')
  const puntoDeVentaId = searchParams.get('puntoDeVentaId')
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limitParam = parseInt(searchParams.get('limit') || '50', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const normalizedLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50
  const limit = Math.min(200, normalizedLimit)
  const skip = (page - 1) * limit

  const whereParts: Prisma.Sql[] = []
  if (fechaDesde) whereParts.push(Prisma.sql`v."createdAt" >= ${new Date(fechaDesde)}`)
  if (fechaHasta) {
    const fechaHastaDate = new Date(fechaHasta)
    fechaHastaDate.setUTCHours(23, 59, 59, 999)
    whereParts.push(Prisma.sql`v."createdAt" <= ${fechaHastaDate}`)
  }
  if (puntoDeVentaId) whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${puntoDeVentaId}`)

  const whereSql = whereParts.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
    : Prisma.sql``

  const ventasPendientesRows = await prisma.$queryRaw<Array<{ ventaId: string; totalPagado: number }>>(Prisma.sql`
    SELECT v."ventaId", COALESCE(SUM(CASE WHEN rv."moneda" = 'CUP' THEN rv."monto" WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio" ELSE rv."monto" END), 0)::double precision AS "totalPagado"
    FROM "Venta" v LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
    ${whereSql}
    GROUP BY v."ventaId", v."total", v."createdAt"
    HAVING (COALESCE(v."total", 0) - COALESCE(SUM(CASE WHEN rv."moneda" = 'CUP' THEN rv."monto" WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio" ELSE rv."monto" END), 0)) > 0.1
    ORDER BY v."createdAt" DESC OFFSET ${skip} LIMIT ${limit}
  `)

  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total FROM (
      SELECT v."ventaId" FROM "Venta" v LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
      ${whereSql}
      GROUP BY v."ventaId", v."total"
      HAVING (COALESCE(v."total", 0) - COALESCE(SUM(CASE WHEN rv."moneda" = 'CUP' THEN rv."monto" WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio" ELSE rv."monto" END), 0)) > 0.1
    ) AS pendientes
  `)

  const total = Number(totalRows[0]?.total || 0)
  const ventaIds = ventasPendientesRows.map((r) => r.ventaId)

  if (ventaIds.length === 0) {
    return NextResponse.json({ ventas: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  }

  const ventasRaw = await prisma.venta.findMany({
    where: { ventaId: { in: ventaIds } },
    include: {
      producto: { select: { nombre: true, precioVenta: true } },
      puntoDeVenta: { select: { nombre: true } },
      empleado: { select: { nombre: true, apellido: true } },
      cliente: { select: { nombre: true } },
      reconciliaciones: { select: { monto: true } }
    }
  })

  const pagosMap = new Map(ventasPendientesRows.map((r) => [r.ventaId, Number(r.totalPagado || 0)]))
  const ventasMap = new Map(ventasRaw.map((v) => [v.ventaId, v]))
  const ventasPaginadas = ventaIds.map((ventaId) => {
    const venta = ventasMap.get(ventaId)
    if (!venta) return null
    const totalVenta = Number(venta.total || 0)
    const totalPagado = pagosMap.get(ventaId) || 0
    return { ...venta, saldoPendiente: Math.max(0, totalVenta - totalPagado), totalPagado }
  }).filter(Boolean)

  return NextResponse.json({ ventas: ventasPaginadas, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function handlePostReconciliacionVentas(request: NextRequest, user: { userId: string; tenantId?: string }) {
  const body = await request.json()
  const validatedData = reconciliacionVentaSchema.parse(body)
  const referenciaTransferenciaRaw = validatedData.verificacionTransferenciaId || validatedData.idTransferencia
  const referenciaTransferencia = referenciaTransferenciaRaw?.trim() || undefined

  const venta = await prisma.venta.findUnique({ where: { ventaId: validatedData.ventaId } })
  if (!venta) return NextResponse.json({ error: 'Venta no encontrada', code: 'VENTA_NO_ENCONTRADA' }, { status: 404 })

  const cuentaBancaria = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: validatedData.cuentaId } })
  if (!cuentaBancaria || !cuentaBancaria.isActive) return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva', code: 'CUENTA_NO_ENCONTRADA' }, { status: 404 })

  const tipoPago = await prisma.tipoPago.findUnique({ where: { tipoId: validatedData.tipoPagoId } })
  if (!tipoPago || !tipoPago.isActive) return NextResponse.json({ error: 'Tipo de pago no encontrado o inactivo', code: 'TIPO_PAGO_INACTIVO' }, { status: 404 })

  if ((validatedData.moneda !== cuentaBancaria.moneda || validatedData.moneda !== 'CUP') && !validatedData.tasaCambio) {
    return NextResponse.json({ error: 'Se requiere tasa de cambio para convertir el pago.', code: 'TASA_CAMBIO_REQUERIDA' }, { status: 400 })
  }

  const tasaCambio = validatedData.tasaCambio ? Number(validatedData.tasaCambio) : undefined
  const montoBase = Number(validatedData.monto)
  const montoAplicadoVentaCUP = normalizeMontoToCup(montoBase, validatedData.moneda, tasaCambio)

  let cuentaOrigen: any = null
  if (tipoPago.requiereCuenta && tipoPago.cuentaDefecto) {
    cuentaOrigen = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: tipoPago.cuentaDefecto } })
    if (!cuentaOrigen || !cuentaOrigen.isActive) return NextResponse.json({ error: 'Cuenta bancaria de origen no encontrada o inactiva', code: 'CUENTA_ORIGEN_INACTIVA' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (referenciaTransferencia) {
      const existingByReference = await tx.reconciliacionVenta.findFirst({
        where: { ventaId: validatedData.ventaId, idTransferencia: referenciaTransferencia },
        include: { venta: { include: { producto: true, puntoDeVenta: true, empleado: true, factura: true, cliente: true } }, cuentaBancaria: true, tipoPago: true }
      })
      if (existingByReference) return existingByReference
    }

    await tx.$queryRaw`SELECT 1 FROM "Venta" WHERE "ventaId" = ${validatedData.ventaId} FOR UPDATE`
    await tx.$queryRaw`SELECT 1 FROM "CuentaBancaria" WHERE "cuentaId" = ${validatedData.cuentaId} FOR UPDATE`
    if (cuentaOrigen) await tx.$queryRaw`SELECT 1 FROM "CuentaBancaria" WHERE "cuentaId" = ${cuentaOrigen.cuentaId} FOR UPDATE`

    const cuentaDestinoLocked = await tx.cuentaBancaria.findUnique({ where: { cuentaId: validatedData.cuentaId } })
    if (!cuentaDestinoLocked || !cuentaDestinoLocked.isActive) throw createReconciliacionError(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta bancaria no encontrada o inactiva')

    const montoDestino = convertMontoToCuentaMoneda(montoBase, validatedData.moneda, cuentaDestinoLocked.moneda, tasaCambio)

    let cuentaOrigenLocked: any = null
    if (cuentaOrigen) {
      cuentaOrigenLocked = await tx.cuentaBancaria.findUnique({ where: { cuentaId: cuentaOrigen.cuentaId }, select: { cuentaId: true, saldo: true, moneda: true } })
      if (!cuentaOrigenLocked) throw createReconciliacionError(404, 'CUENTA_ORIGEN_INACTIVA', 'Cuenta de origen no encontrada')
      const montoOrigen = convertMontoToCuentaMoneda(montoBase, validatedData.moneda, cuentaOrigenLocked.moneda, tasaCambio)
      if (cuentaOrigenLocked.saldo < montoOrigen) throw createReconciliacionError(400, 'SALDO_INSUFICIENTE', 'Saldo insuficiente en la cuenta de origen')
    }

    const reconciliacionesPrevias = await tx.reconciliacionVenta.findMany({
      where: { ventaId: validatedData.ventaId }, select: { monto: true, moneda: true, tasaCambio: true }
    })

    const totalPagadoPrevio = reconciliacionesPrevias.reduce((sum, rec) =>
      sum + normalizeMontoToCup(Number(rec.monto || 0), rec.moneda || 'CUP', rec.tasaCambio ? Number(rec.tasaCambio) : undefined), 0)

    const totalVenta = Number(venta.total || 0)
    const nuevoTotalPagado = totalPagadoPrevio + montoAplicadoVentaCUP
    if (nuevoTotalPagado > totalVenta + 0.1) {
      throw createReconciliacionError(400, 'MONTO_EXCEDIDO', `El monto excede el saldo pendiente. Total venta (CUP): ${totalVenta}, Pagado (CUP): ${totalPagadoPrevio.toFixed(2)}, Intento (CUP): ${montoAplicadoVentaCUP.toFixed(2)}`)
    }

    const reconciliacion = await tx.reconciliacionVenta.create({
      data: {
        ventaId: validatedData.ventaId, cuentaId: validatedData.cuentaId, tipoPagoId: validatedData.tipoPagoId,
        monto: validatedData.monto, moneda: validatedData.moneda,
        ...(validatedData.tasaCambio != null && { tasaCambio: validatedData.tasaCambio }),
        montoConvertido: montoDestino, verificacionTransferenciaId: referenciaTransferencia,
        ...(validatedData.observaciones != null && { observaciones: validatedData.observaciones }),
        idTransferencia: referenciaTransferencia, reconciliadoPor: user.userId, tenantId: venta.tenantId
      },
      include: { venta: { include: { producto: true, puntoDeVenta: true, empleado: true, factura: true, cliente: true } }, cuentaBancaria: true, tipoPago: true }
    })

    const saldoIncrementoDestino = parseFloat(montoDestino.toString())

    if (cuentaOrigen && tipoPago.cuentaDefecto !== validatedData.cuentaId) {
      const montoOrigenVal = convertMontoToCuentaMoneda(montoBase, validatedData.moneda, cuentaOrigenLocked?.moneda || validatedData.moneda, tasaCambio)
      await tx.cuentaBancaria.update({ where: { cuentaId: tipoPago.cuentaDefecto! }, data: { saldo: { decrement: parseFloat(montoOrigenVal.toString()) } } })
      await tx.cuentaBancaria.update({ where: { cuentaId: validatedData.cuentaId }, data: { saldo: { increment: saldoIncrementoDestino } } })
    } else {
      await tx.cuentaBancaria.update({ where: { cuentaId: validatedData.cuentaId }, data: { saldo: { increment: saldoIncrementoDestino } } })
    }

    if (validatedData.tasaCambio) {
      await tx.transaccionMoneda.create({
        data: { tipoTransaccion: 'venta', referenciaId: validatedData.ventaId, monedaId: validatedData.moneda, montoOriginal: validatedData.monto, tasaCambio: validatedData.tasaCambio, montoConvertido: montoDestino }
      })
    }

    const saldoRestante = Math.max(0, totalVenta - nuevoTotalPagado)
    let nuevoEstado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' = 'PENDIENTE'
    if (saldoRestante <= 0.01) nuevoEstado = 'PAGADA'
    else if (nuevoTotalPagado > 0) nuevoEstado = 'PARCIAL'

    const ventaRec = await tx.venta.findUnique({
      where: { ventaId: validatedData.ventaId },
      include: { factura: true }
    })
    if (!ventaRec) throw createReconciliacionError(500, 'VENTA_NOT_FOUND', 'Venta no encontrada tras reconciliación')

    const facturaId = ventaRec.factura?.idFactura
    if (ventaRec.clienteId) {
      let existingCxC = null
      if (facturaId) existingCxC = await tx.cuentaPorCobrar.findUnique({ where: { facturaId } })
      if (!existingCxC) {
        const candidates = getNumeroFacturaCandidates(ventaRec.ordenId, ventaRec.factura?.numeroFactura)
        if (candidates.length > 0) existingCxC = await tx.cuentaPorCobrar.findFirst({ where: { numeroFactura: { in: candidates } }, orderBy: { updatedAt: 'desc' } })
      }
      if (existingCxC) {
        await tx.cuentaPorCobrar.update({
          where: { id: existingCxC.id },
          data: { montoPagado: nuevoTotalPagado, estado: nuevoEstado, idTransferencia: referenciaTransferencia || existingCxC.idTransferencia }
        })
      } else if (saldoRestante > 0.01) {
        const cliente = await tx.cliente.findUnique({ where: { clienteId: ventaRec.clienteId } })
        if (!cliente) throw createReconciliacionError(500, 'CLIENTE_NOT_FOUND', 'Cliente no encontrado')
        await tx.cuentaPorCobrar.create({
          data: { clienteId: ventaRec.clienteId, tenantId: venta.tenantId ?? '', facturaId, numeroFactura: ventaRec.ordenId || ventaRec.factura?.numeroFactura, montoDeuda: totalVenta, montoPagado: nuevoTotalPagado, estado: nuevoEstado, idTransferencia: referenciaTransferencia }
        })
      }
    }

    return reconciliacion
  })

  try {
    await AuditLogService.log({
      accion: "CREATE", entidad: "RECONCILIACION", entidadId: result.reconciliacionId, usuarioId: user.userId,
      detalles: { tipo: "VENTA", ventaId: result.ventaId, cuenta: validatedData.cuentaId, monto: result.monto, moneda: result.moneda, montoConvertido: result.montoConvertido, tipoPago: validatedData.tipoPagoId }
    })
  } catch (e) { console.error('Error registrando auditoría de reconciliación de venta:', e) }

  return NextResponse.json({ message: 'Venta reconciliada exitosamente', reconciliacion: result }, { status: 201 })
}

export async function handleGetReconciliacionVentasHistorial(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fechaDesde = searchParams.get('fechaDesde') || searchParams.get('fechaInicio')
  const fechaHasta = searchParams.get('fechaHasta') || searchParams.get('fechaFin')
  const cuentaId = searchParams.get('cuentaId')
  const tipoPagoId = searchParams.get('tipoPagoId')
  const puntoDeVentaId = searchParams.get('puntoDeVentaId')
  const reconciliadoPor = searchParams.get('reconciliadoPor')
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limitParam = parseInt(searchParams.get('limit') || '50', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const normalizedLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50
  const limit = Math.min(200, normalizedLimit)
  const skip = (page - 1) * limit

  const whereClause: any = {}
  if (fechaDesde || fechaHasta) {
    whereClause.fechaReconciliacion = {}
    if (fechaDesde) whereClause.fechaReconciliacion.gte = new Date(fechaDesde)
    if (fechaHasta) whereClause.fechaReconciliacion.lte = new Date(fechaHasta)
  }
  if (cuentaId) whereClause.cuentaId = cuentaId
  if (tipoPagoId) whereClause.tipoPagoId = tipoPagoId
  if (reconciliadoPor) whereClause.reconciliadoPor = reconciliadoPor
  if (puntoDeVentaId) whereClause.venta = { puntoDeVentaId }

  const [reconciliaciones, total] = await Promise.all([
    prisma.reconciliacionVenta.findMany({
      where: whereClause,
      include: {
        venta: { include: { producto: { select: { nombre: true, precioVenta: true } }, puntoDeVenta: { select: { nombre: true } }, empleado: { select: { nombre: true, apellido: true } }, cliente: { select: { nombre: true } } } },
        cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } },
        tipoPago: { select: { nombre: true, descripcion: true } }
      },
      orderBy: { fechaReconciliacion: 'desc' }, skip, take: limit
    }),
    prisma.reconciliacionVenta.count({ where: whereClause })
  ])

  const estadisticas = await prisma.reconciliacionVenta.aggregate({
    where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true }
  })

  const porMoneda = await prisma.reconciliacionVenta.groupBy({
    by: ['moneda'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true }
  })

  const porTipoPago = await prisma.reconciliacionVenta.groupBy({
    by: ['tipoPagoId'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true }
  })

  const tiposPagoInfo = await prisma.tipoPago.findMany({
    where: { tipoId: { in: porTipoPago.map((tp: any) => tp.tipoPagoId) } },
    select: { tipoId: true, nombre: true }
  })

  const resumenTiposPago = porTipoPago.map((tp: any) => ({
    ...tp, nombre: tiposPagoInfo.find((i: any) => i.tipoId === tp.tipoPagoId)?.nombre || 'Desconocido'
  }))

  return NextResponse.json({
    reconciliaciones,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    estadisticas: {
      totalReconciliaciones: estadisticas._count.reconciliacionId || 0, montoTotal: estadisticas._sum.monto || 0,
      montoConvertidoTotal: estadisticas._sum.montoConvertido || 0, porMoneda, porTipoPago: resumenTiposPago
    }
  })
}
