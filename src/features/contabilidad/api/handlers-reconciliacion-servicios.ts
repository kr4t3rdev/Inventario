import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { AuditLogService } from '@/lib/services/audit-log-service'

export const reconciliacionServicioSchema = z.object({
  ventaServicioId: z.string().min(1, 'ID de venta de servicio es requerido'),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido'),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido'),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  observaciones: z.string().optional()
})

export async function handleGetReconciliacionServicios(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fechaDesde = searchParams.get('fechaDesde'); const fechaHasta = searchParams.get('fechaHasta')
  const page = parseInt(searchParams.get('page') || '1'); const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  const whereClause: any = {}
  if (fechaDesde || fechaHasta) { whereClause.createdAt = {}; if (fechaDesde) whereClause.createdAt.gte = new Date(fechaDesde); if (fechaHasta) whereClause.createdAt.lte = new Date(fechaHasta) }

  const [ventaServicios, total] = await Promise.all([
    prisma.ventaServicios.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, skip, include: { cliente: true, servicio: true, reconciliaciones: { select: { montoConvertido: true } } } }),
    prisma.ventaServicios.count({ where: whereClause })
  ])

  return NextResponse.json({ ventaServicios, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function handlePostReconciliacionServicios(request: NextRequest, user: { userId: string; tenantId?: string }) {
  const body = await request.json()
  const validatedData = reconciliacionServicioSchema.parse(body)

  const ventaServicio = await prisma.ventaServicios.findUnique({ where: { ventaServicioId: validatedData.ventaServicioId } })
  if (!ventaServicio) return NextResponse.json({ error: 'Servicio no encontrado', code: 'SERVICIO_NO_ENCONTRADO' }, { status: 404 })

  const cuentaBancaria = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: validatedData.cuentaId } })
  if (!cuentaBancaria || !cuentaBancaria.isActive) return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva', code: 'CUENTA_NO_ENCONTRADA' }, { status: 404 })

  const tipoPago = await prisma.tipoPago.findFirst({ where: { tipoId: validatedData.tipoPagoId, tenantId: user.tenantId } })
  if (!tipoPago || !tipoPago.isActive) return NextResponse.json({ error: 'Tipo de pago no encontrado o inactivo', code: 'TIPO_PAGO_INACTIVO' }, { status: 404 })

  let montoConvertido = validatedData.monto
  if (cuentaBancaria.moneda !== 'CUP' && validatedData.tasaCambio) montoConvertido = validatedData.monto * validatedData.tasaCambio

  let cuentaOrigen: any = null
  if (tipoPago.requiereCuenta && tipoPago.cuentaDefecto) {
    cuentaOrigen = await prisma.cuentaBancaria.findFirst({ where: { cuentaId: tipoPago.cuentaDefecto, tenantId: user.tenantId } })
    if (!cuentaOrigen || !cuentaOrigen.isActive) return NextResponse.json({ error: 'Cuenta bancaria de origen no encontrada o inactiva', code: 'CUENTA_ORIGEN_INACTIVA' }, { status: 404 })
    if (cuentaOrigen.saldo < montoConvertido) return NextResponse.json({ error: 'Saldo insuficiente en la cuenta de origen', code: 'SALDO_INSUFICIENTE' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const reconciliacion = await tx.reconciliacionServicio.create({
      data: { ventaServicioId: validatedData.ventaServicioId, cuentaId: validatedData.cuentaId, tipoPagoId: validatedData.tipoPagoId, monto: validatedData.monto, moneda: validatedData.moneda, tasaCambio: validatedData.tasaCambio, montoConvertido, observaciones: validatedData.observaciones, reconciliadoPor: user.userId, tenantId: ventaServicio.tenantId },
      include: { ventasServicio: true, cuentaBancaria: true, tipoPago: true }
    })

    const saldoIncremento = parseFloat(montoConvertido.toString())
    if (cuentaOrigen && tipoPago.cuentaDefecto !== validatedData.cuentaId) {
      await tx.cuentaBancaria.update({ where: { cuentaId: tipoPago.cuentaDefecto! }, data: { saldo: { decrement: saldoIncremento } } })
      await tx.cuentaBancaria.update({ where: { cuentaId: validatedData.cuentaId }, data: { saldo: { increment: saldoIncremento } } })
    } else {
      await tx.cuentaBancaria.update({ where: { cuentaId: validatedData.cuentaId }, data: { saldo: { increment: saldoIncremento } } })
    }

    if (validatedData.moneda !== 'CUP' && validatedData.tasaCambio) {
      await tx.transaccionMoneda.create({ data: { tipoTransaccion: 'servicio', referenciaId: validatedData.ventaServicioId, monedaId: validatedData.moneda, montoOriginal: validatedData.monto, tasaCambio: validatedData.tasaCambio, montoConvertido } })
    }

    return reconciliacion
  })

  await AuditLogService.log({ accion: "CREATE", entidad: "RECONCILIACION", entidadId: result.reconciliacionId, usuarioId: user.userId, detalles: { tipo: "SERVICIO", ventaServicioId: result.ventaServicioId, cuenta: validatedData.cuentaId, monto: result.monto, moneda: result.moneda, montoConvertido: result.montoConvertido, tipoPago: validatedData.tipoPagoId } })

  return NextResponse.json({ message: 'Servicio reconciliado exitosamente', reconciliacion: result }, { status: 201 })
}

export async function handleGetReconciliacionServiciosHistorial(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fechaDesde = searchParams.get('fechaDesde'); const fechaHasta = searchParams.get('fechaHasta')
  const cuentaId = searchParams.get('cuentaId'); const tipoPagoId = searchParams.get('tipoPagoId')
  const reconciliadoPor = searchParams.get('reconciliadoPor')
  const page = parseInt(searchParams.get('page') || '1'); const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  const whereClause: any = {}
  if (fechaDesde || fechaHasta) { whereClause.fechaReconciliacion = {}; if (fechaDesde) whereClause.fechaReconciliacion.gte = new Date(fechaDesde); if (fechaHasta) whereClause.fechaReconciliacion.lte = new Date(fechaHasta) }
  if (cuentaId) whereClause.cuentaId = cuentaId; if (tipoPagoId) whereClause.tipoPagoId = tipoPagoId; if (reconciliadoPor) whereClause.reconciliadoPor = reconciliadoPor

  const [reconciliaciones, total] = await Promise.all([
    prisma.reconciliacionServicio.findMany({
      where: whereClause,
      include: { ventasServicio: { include: { servicio: { select: { servicioId: true, nombre: true, precio: true, descripcion: true, moneda: true } } } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, tipoPago: { select: { nombre: true, descripcion: true } } },
      orderBy: { fechaReconciliacion: 'desc' }, skip, take: limit
    }),
    prisma.reconciliacionServicio.count({ where: whereClause })
  ])

  const estadisticas = await prisma.reconciliacionServicio.aggregate({ where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const porMoneda = await prisma.reconciliacionServicio.groupBy({ by: ['moneda'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const porTipoPago = await prisma.reconciliacionServicio.groupBy({ by: ['tipoPagoId'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const tiposPagoInfo = await prisma.tipoPago.findMany({ where: { tipoId: { in: porTipoPago.map((tp: any) => tp.tipoPagoId) } }, select: { tipoId: true, nombre: true } })
  const porCuenta = await prisma.reconciliacionServicio.groupBy({ by: ['cuentaId'], where: whereClause, _sum: { monto: true, montoConvertido: true }, _count: { reconciliacionId: true } })
  const cuentasInfo = await prisma.cuentaBancaria.findMany({ where: { cuentaId: { in: porCuenta.map((c: any) => c.cuentaId) } }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, moneda: true } })

  return NextResponse.json({
    reconciliaciones, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    estadisticas: { totalReconciliaciones: estadisticas._count.reconciliacionId || 0, montoTotal: estadisticas._sum.monto || 0, montoConvertidoTotal: estadisticas._sum.montoConvertido || 0, porMoneda, porTipoPago: porTipoPago.map((tp: any) => ({ ...tp, nombre: tiposPagoInfo.find((i: any) => i.tipoId === tp.tipoPagoId)?.nombre || 'Desconocido' })), porCuenta: porCuenta.map((c: any) => ({ ...c, cuenta: cuentasInfo.find((i: any) => i.cuentaId === c.cuentaId) || null })) }
  })
}
