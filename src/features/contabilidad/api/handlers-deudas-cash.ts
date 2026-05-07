import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { requireTenant } from '@/lib/services/tenant-scope'
import { calcularSaldoPendienteDeuda, calcularTotalDeudaConInteres, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'

function deudasCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false' }

export const deudasCashQuerySchema = z.object({
  estado: z.enum(['ACTIVO', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  proveedorId: z.string().optional(), moneda: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
})

export const deudasCashCreateSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedorId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(), observaciones: z.string().optional(),
  comprobanteUrl: z.string().url().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida')
})

export async function handleGetDeudasCash(request: NextRequest, user: AuthenticatedUser) {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const tenantId = requireTenant(user)
  const { searchParams } = new URL(request.url)
  const query = deudasCashQuerySchema.parse({
    estado: searchParams.get('estado') || undefined, proveedorId: searchParams.get('proveedorId') || undefined,
    moneda: searchParams.get('moneda') || undefined, page: searchParams.get('page') || undefined, limit: searchParams.get('limit') || undefined
  })
  const skip = (query.page - 1) * query.limit
  const where = { tenantId, deletedAt: null, ...(query.estado ? { estado: query.estado } : {}), ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}), ...(query.moneda ? { moneda: query.moneda } : {}) }

  const [deudas, total] = await Promise.all([
    prisma.deudaCash.findMany({ where, include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true, reconciliaciones: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } } }, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
    prisma.deudaCash.count({ where })
  ])

  return NextResponse.json({
    deudas: deudas.map((d) => ({ ...d, estado: normalizarEstadoDeudaCash(d.estado, { montoDeuda: Number(d.cuentaPorPagar?.montoDeuda ?? d.montoCapital), montoPagado: Number(d.cuentaPorPagar?.montoPagado ?? 0), estado: d.cuentaPorPagar?.estado }), saldoPendiente: calcularSaldoPendienteDeuda(Number(d.cuentaPorPagar?.montoDeuda ?? d.montoCapital), Number(d.cuentaPorPagar?.montoPagado ?? 0)) })),
    pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
  })
}

export async function handlePostDeudasCash(request: NextRequest, user: AuthenticatedUser) {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const tenantId = requireTenant(user)
  const rawBody = await request.json(); const body = deudasCashCreateSchema.parse(rawBody)
  const totalDeuda = calcularTotalDeudaConInteres(body.montoCapital, body.tasaInteres)

  const proveedor = await prisma.vendor.findUnique({ where: { vendorId: body.proveedorId }, select: { nombre: true } })
  if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  const deuda = await prisma.$transaction(async (tx: any) => {
    const tp = (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true } })) || (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true } }))
    if (!tp) throw new Error('No existe un tipo de pago válido para el desembolso de deuda')
    await tx.cuentaBancaria.update({ where: { cuentaId: body.cuentaBancariaId }, data: { saldo: { increment: body.montoCapital } } })
    const lastDeuda = await tx.deudaCash.findFirst({ orderBy: { idNumerico: 'desc' }, select: { idNumerico: true } })
    const nextNum = (lastDeuda?.idNumerico ?? 0) + 1
    const cxp = await tx.cuentaPorPagar.create({ data: { tenantId, numeroFactura: `DC-${nextNum}`, proveedorId: body.proveedorId, proveedorNombre: proveedor.nombre, montoDeuda: totalDeuda, montoPagado: 0, saldoPendiente: totalDeuda, moneda: body.moneda, tipo: 'compra', tipoDeuda: 'DEUDA_CASH', estado: 'PENDIENTE', fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined } })
    await tx.reconciliacionVenta.create({ data: { tenantId, cuentaId: body.cuentaBancariaId, tipoPagoId: tp.tipoId, monto: body.montoCapital, moneda: body.moneda, montoConvertido: body.montoCapital, fechaReconciliacion: new Date(), observaciones: body.observaciones || `Desembolso de deuda cash para proveedor ${body.proveedorId}`, reconciliadoPor: user.userId, deudaCashId: null, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' } })
    return tx.deudaCash.create({ data: { tenantId, proveedorId: body.proveedorId, cuentaPorPagarId: cxp.cuentaPorPagarId, montoCapital: body.montoCapital, montoTotalDeuda: totalDeuda, moneda: body.moneda, tasaInteres: body.tasaInteres, fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined, observaciones: body.observaciones, comprobanteUrl: body.comprobanteUrl, cuentaBancariaId: body.cuentaBancariaId, createdById: user.userId }, include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true } })
  })

  await AuditLogService.log({ accion: 'CREATE', entidad: 'DEUDA_CASH', entidadId: deuda.id, usuarioId: user.userId, detalles: { proveedorId: body.proveedorId, montoCapital: body.montoCapital, moneda: body.moneda } })
  return NextResponse.json({ deuda }, { status: 201 })
}

const deudaCashUpdateSchema = z.object({ fechaVencimiento: z.string().optional(), tasaInteres: z.coerce.number().positive().optional(), observaciones: z.string().optional(), montoCapital: z.never().optional(), moneda: z.never().optional() }).strict()

export async function handleGetDeudaCashById(context: { params: Promise<{ id: string }> }) {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const deuda = await prisma.deudaCash.findFirst({ where: { id, deletedAt: null }, include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true } })
  if (!deuda) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
  return NextResponse.json({ deuda })
}

export async function handlePutDeudaCash(request: NextRequest, context: { params: Promise<{ id: string }> }, user: { userId: string }) {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  if (body.montoCapital !== undefined || body.moneda !== undefined) return NextResponse.json({ error: 'No se permite modificar montoCapital ni moneda de una deuda existente' }, { status: 400 })
  const data = deudaCashUpdateSchema.parse(body)
  const existing = await prisma.deudaCash.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
  const deuda = await prisma.deudaCash.update({ where: { id }, data: { ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}), ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}), ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {}) }, include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true } })
  await AuditLogService.log({ accion: 'UPDATE', entidad: 'DEUDA_CASH', entidadId: id, usuarioId: user.userId, detalles: { cambios: { ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: deuda.fechaVencimiento } } : {}), ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(deuda.tasaInteres) } } : {}), ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: deuda.observaciones } } : {}) } } })
  return NextResponse.json({ deuda })
}

export const deudaCashPagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'), cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'), moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(), observaciones: z.string().optional()
})

export async function handlePostDeudaCashPago(request: NextRequest, context: { params: Promise<{ id: string }> }, user: { userId: string }) {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = deudaCashPagoSchema.parse(await request.json())
  const deuda = await prisma.deudaCash.findFirst({ where: { id, deletedAt: null }, include: { cuentaPorPagar: true } })
  if (!deuda) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
  if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') return NextResponse.json({ error: 'La deuda no admite más pagos' }, { status: 400 })
  const sp = calcularSaldoPendienteDeuda(Number(deuda.cuentaPorPagar.montoDeuda), Number(deuda.cuentaPorPagar.montoPagado))
  if (body.monto > sp) return NextResponse.json({ error: `El monto excede el saldo pendiente de ${sp}` }, { status: 400 })

  const resultado = await prisma.$transaction(async (tx: any) => {
    const r = await tx.reconciliacionVenta.create({ data: { cuentaId: body.cuentaId, tipoPagoId: body.tipoPagoId, monto: body.monto, moneda: body.moneda || deuda.moneda, ...(body.tasaCambio != null && { tasaCambio: body.tasaCambio }), ...(body.observaciones != null && { observaciones: body.observaciones }), reconciliadoPor: user.userId, deudaCashId: deuda.id, tipoReconciliacion: 'DEUDA_CASH' } })
    await tx.cuentaBancaria.update({ where: { cuentaId: body.cuentaId }, data: { saldo: { decrement: body.monto } } })
    const nmp = Number((Number(deuda.cuentaPorPagar.montoPagado) + body.monto).toFixed(2))
    const td = Number(deuda.cuentaPorPagar.montoDeuda); const nsp = calcularSaldoPendienteDeuda(td, nmp); const nec = nsp <= 0.01 ? 'PAGADA' : 'PARCIAL'
    await tx.cuentaPorPagar.update({ where: { cuentaPorPagarId: deuda.cuentaPorPagarId }, data: { montoPagado: nmp, saldoPendiente: nsp, estado: nec } })
    if (nec === 'PAGADA') await tx.deudaCash.update({ where: { id: deuda.id }, data: { estado: 'PAGADO' } })
    return r
  })

  await AuditLogService.log({ accion: 'CREATE', entidad: 'PAGO_DEUDA', entidadId: resultado.reconciliacionId, usuarioId: user.userId, detalles: { deudaId: deuda.id, monto: body.monto, moneda: body.moneda || deuda.moneda } })
  return NextResponse.json({ reconciliacion: resultado }, { status: 201 })
}

export async function handleGetDeudasCashStats() {
  if (!deudasCashEnabled()) return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
  const [totalActivas, totalPagadas, totalVencidas, montosPorMoneda] = await Promise.all([
    prisma.deudaCash.count({ where: { estado: 'ACTIVO', deletedAt: null } }),
    prisma.deudaCash.count({ where: { estado: 'PAGADO', deletedAt: null } }),
    prisma.deudaCash.count({ where: { estado: 'VENCIDO', deletedAt: null } }),
    prisma.deudaCash.groupBy({ by: ['moneda'], where: { estado: { not: 'CANCELADO' }, deletedAt: null }, _sum: { montoCapital: true } })
  ])
  const cuentasPendientes = await prisma.cuentaPorPagar.findMany({ where: { tipoDeuda: 'DEUDA_CASH', estado: { not: 'PAGADA' } }, select: { montoDeuda: true, montoPagado: true, deudaCash: { select: { moneda: true } } } })
  const montoPendientePago: Record<string, number> = {}
  for (const c of cuentasPendientes) { const m = c.deudaCash?.moneda ?? 'CUP'; montoPendientePago[m] = (montoPendientePago[m] ?? 0) + (Number(c.montoDeuda) - Number(c.montoPagado)) }
  const montoTotalDeuda: Record<string, number> = {}
  for (const g of montosPorMoneda) montoTotalDeuda[g.moneda] = Number(g._sum.montoCapital ?? 0)
  return NextResponse.json({ totalActivas, totalPagadas, totalVencidas, montoTotalDeuda, montoPendientePago })
}
