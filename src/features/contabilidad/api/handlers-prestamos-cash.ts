import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { requireTenant } from '@/lib/services/tenant-scope'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service'
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine'
import { buildEventoCobroPrestamo, buildEventoPrestamoOtorgado } from '@/features/contabilidad-formal/lib/event-builders'

function prestamosCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false' }

export const prestamosCashQuerySchema = z.object({
  estado: z.enum(['ACTIVO', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  clienteId: z.string().optional(), moneda: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
})

export const prestamosCashCreateSchema = z.object({
  clienteId: z.string().min(1, 'El clienteId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(), observaciones: z.string().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida')
})

export async function handleGetPrestamosCash(request: NextRequest, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  const { searchParams } = new URL(request.url)
  const query = prestamosCashQuerySchema.parse({
    estado: searchParams.get('estado') || undefined, clienteId: searchParams.get('clienteId') || undefined,
    moneda: searchParams.get('moneda') || undefined, page: searchParams.get('page') || undefined, limit: searchParams.get('limit') || undefined
  })
  const skip = (query.page - 1) * query.limit
  const where = { tenantId, deletedAt: null, ...(query.estado ? { estado: query.estado } : {}), ...(query.clienteId ? { clienteId: query.clienteId } : {}), ...(query.moneda ? { moneda: query.moneda } : {}) }

  const [prestamos, total] = await Promise.all([
    prisma.prestamoCash.findMany({ where, include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true, reconciliaciones: { include: { tipoPago: true, cuentaBancaria: true }, orderBy: { fechaReconciliacion: 'desc' } } }, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
    prisma.prestamoCash.count({ where })
  ])

  return NextResponse.json({
    prestamos: prestamos.map((p) => ({ ...p, estado: normalizarEstadoPrestamoCash(p.estado, { montoDeuda: Number(p.cuentaPorCobrar?.montoDeuda ?? p.montoCapital), montoPagado: Number(p.cuentaPorCobrar?.montoPagado ?? 0), estado: p.cuentaPorCobrar?.estado }), saldoPendiente: calcularSaldoPendientePrestamo(Number(p.cuentaPorCobrar?.montoDeuda ?? p.montoCapital), Number(p.cuentaPorCobrar?.montoPagado ?? 0)) })),
    pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
  })
}

export async function handlePostPrestamosCash(request: NextRequest, user: AuthenticatedUser) {
  const tenantId = requireTenant(user)
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const body = prestamosCashCreateSchema.parse(await request.json())

  const cuentaOrigen = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: body.cuentaBancariaId }, select: { cuentaId: true, saldo: true, isActive: true } })
  if (!cuentaOrigen || !cuentaOrigen.isActive) return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
  if (cuentaOrigen.saldo < body.montoCapital) return NextResponse.json({ error: `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}` }, { status: 400 })

  const tp = (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) || (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }))
  if (!tp) return NextResponse.json({ error: 'No existe un tipo de pago válido para registrar el desembolso' }, { status: 400 })

  const prestamo = await prisma.$transaction(async (tx: any) => {
    await tx.cuentaBancaria.update({ where: { cuentaId: body.cuentaBancariaId }, data: { saldo: { decrement: body.montoCapital } } })
    const montoDeuda = body.tasaInteres ? Number((body.montoCapital * (1 + body.tasaInteres / 100)).toFixed(2)) : body.montoCapital
    const cxc = await tx.cuentaPorCobrar.create({ data: { tenantId, clienteId: body.clienteId, montoDeuda, montoPagado: 0, tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE', fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined } })
     await tx.reconciliacionVenta.create({ data: { tenantId, cuentaId: body.cuentaBancariaId, tipoPagoId: tp.tipoId, monto: body.montoCapital, moneda: body.moneda, ...buildPersistedAccountingAmount(body.montoCapital, body.moneda, body.tasaCambioAlCrear), fechaReconciliacion: new Date(), observaciones: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`, reconciliadoPor: user.userId, prestamoCashId: null, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO' } })
    const prestamoCreado = await tx.prestamoCash.create({ data: { clienteId: body.clienteId, cuentaPorCobrarId: cxc.id, montoCapital: body.montoCapital, moneda: body.moneda, tasaInteres: body.tasaInteres, tasaCambioAlCrear: body.tasaCambioAlCrear, fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined, observaciones: body.observaciones, cuentaBancariaId: body.cuentaBancariaId, createdById: user.userId }, include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true } })
    // Capa de contabilidad formal (CTA-1): desembolso de préstamo otorgado.
    await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPrestamoOtorgado({
      prestamoId: prestamoCreado.id,
      valoracion: { monto: body.montoCapital, moneda: body.moneda },
      descripcion: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`,
    }))
    return prestamoCreado
  })

  await AuditLogService.log({ accion: 'CREATE', entidad: 'PRESTAMO_CASH', entidadId: prestamo.id, usuarioId: user.userId, detalles: { clienteId: body.clienteId, montoCapital: body.montoCapital, moneda: body.moneda } })
  return NextResponse.json({ prestamo }, { status: 201 })
}

const prestamoCashUpdateSchema = z.object({ fechaVencimiento: z.string().optional(), tasaInteres: z.coerce.number().positive().optional(), observaciones: z.string().optional(), montoCapital: z.never().optional(), moneda: z.never().optional() }).strict()

export async function handleGetPrestamoCashById(context: { params: Promise<{ id: string }> }) {
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const prestamo = await prisma.prestamoCash.findFirst({ where: { id, deletedAt: null }, include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true } })
  if (!prestamo) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  return NextResponse.json({ prestamo: { ...prestamo, estado: normalizarEstadoPrestamoCash(prestamo.estado, { montoDeuda: Number(prestamo.cuentaPorCobrar.montoDeuda), montoPagado: Number(prestamo.cuentaPorCobrar.montoPagado), estado: prestamo.cuentaPorCobrar.estado }), saldoPendiente: calcularSaldoPendientePrestamo(Number(prestamo.cuentaPorCobrar.montoDeuda), Number(prestamo.cuentaPorCobrar.montoPagado)) } })
}

export async function handlePutPrestamoCash(request: NextRequest, context: { params: Promise<{ id: string }> }, user: { userId: string }) {
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  if (body.montoCapital !== undefined || body.moneda !== undefined) return NextResponse.json({ error: 'No se permite modificar montoCapital ni moneda de un préstamo existente' }, { status: 400 })
  const data = prestamoCashUpdateSchema.parse(body)
  const existing = await prisma.prestamoCash.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  const prestamo = await prisma.prestamoCash.update({ where: { id }, data: { ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}), ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}), ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {}) }, include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true } })
  await AuditLogService.log({ accion: 'UPDATE', entidad: 'PRESTAMO_CASH', entidadId: id, usuarioId: user.userId, detalles: { cambios: { ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: prestamo.fechaVencimiento } } : {}), ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(prestamo.tasaInteres) } } : {}), ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: prestamo.observaciones } } : {}) } } })
  return NextResponse.json({ prestamo: { ...prestamo, estado: normalizarEstadoPrestamoCash(prestamo.estado, { montoDeuda: Number(prestamo.cuentaPorCobrar.montoDeuda), montoPagado: Number(prestamo.cuentaPorCobrar.montoPagado), estado: prestamo.cuentaPorCobrar.estado }), saldoPendiente: calcularSaldoPendientePrestamo(Number(prestamo.cuentaPorCobrar.montoDeuda), Number(prestamo.cuentaPorCobrar.montoPagado)) } })
}

function formatCurrency(amount: number, moneda: string): string {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

function generateComprobantePDF(page: any, fontRegular: any, fontBold: any, prestamo: any) {
  const { height } = page.getSize()
  const left = 50; const right = 545; const centerX = (left + right) / 2
  const montoCapital = Number(prestamo.montoCapital); const montoDeuda = Number(prestamo.cuentaPorCobrar.montoDeuda)
  const moneda = prestamo.moneda || 'CUP'; const tc = prestamo.tasaCambioAlCrear ? Number(prestamo.tasaCambioAlCrear) : null
  const esFC = moneda !== 'CUP' && tc

  let y = height - 50
  page.drawRectangle({ x: 30, y: height / 2 + 10, width: 535, height: height / 2 - 30, borderWidth: 1, borderColor: rgb(0, 0, 0) })
  const tC = 'COMPROBANTE DE PRÉSTAMO — Copia Cliente'
  page.drawText(tC, { x: centerX - (fontBold.widthOfTextAtSize(tC, 14) / 2), y, size: 14, font: fontBold }); y -= 24
  const hLines = [`Comprobante No: PREST-${prestamo.idNumerico}`, `Fecha: ${new Date(prestamo.fechaOtorgamiento).toLocaleDateString('es-ES')}`]
  hLines.forEach((t) => { page.drawText(t, { x: right - fontRegular.widthOfTextAtSize(t, 11), y, size: 11, font: fontRegular }); y -= 14 }); y -= 8
  page.drawText('DATOS DEL CLIENTE:', { x: left, y, size: 12, font: fontBold }); y -= 16
  page.drawText(`Nombre: ${prestamo.cliente?.nombre || 'Desconocido'}`, { x: left + 20, y, size: 11, font: fontRegular }); y -= 20
  page.drawText('DETALLES DEL PRÉSTAMO:', { x: left, y, size: 12, font: fontBold }); y -= 16
  const cDet: string[] = [`Monto Solicitado (Capital): ${formatCurrency(montoCapital, moneda)}`, `Monto a Pagar: ${formatCurrency(montoDeuda, moneda)}`]
  if (esFC) cDet.push(`Tasa de Cambio: ${tc} CUP/${moneda}`)
  if (prestamo.fechaVencimiento) cDet.push(`Fecha de Vencimiento: ${new Date(prestamo.fechaVencimiento).toLocaleDateString('es-ES')}`)
  cDet.forEach((t) => { page.drawText(t, { x: left + 20, y, size: 11, font: fontRegular }); y -= 14 }); y -= 6
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: rgb(0, 0, 0), thickness: 1 }); y -= 10
  const fc = 'Este comprobante es válido como constancia del préstamo otorgado.'
  page.drawText(fc, { x: centerX - fontRegular.widthOfTextAtSize(fc, 9) / 2, y, size: 9, font: fontRegular })

  const cutY = height / 2
  let dashX = left
  while (dashX < right) { const e = Math.min(dashX + 10, right); page.drawLine({ start: { x: dashX, y: cutY }, end: { x: e, y: cutY }, color: rgb(0.5, 0.5, 0.5), thickness: 0.5 }); dashX = e + 5 }
  const st = '--- Cortar aqui ---'; page.drawText(st, { x: centerX - fontRegular.widthOfTextAtSize(st, 8) / 2, y: cutY + 4, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) })

  y = cutY - 30
  page.drawRectangle({ x: 30, y: 20, width: 535, height: cutY - 40, borderWidth: 1, borderColor: rgb(0, 0, 0) })
  const tI = 'COMPROBANTE DE PRÉSTAMO — Copia Interna'
  page.drawText(tI, { x: centerX - (fontBold.widthOfTextAtSize(tI, 14) / 2), y, size: 14, font: fontBold }); y -= 24
  hLines.forEach((t) => { page.drawText(t, { x: right - fontRegular.widthOfTextAtSize(t, 11), y, size: 11, font: fontRegular }); y -= 14 }); y -= 8
  page.drawText('DATOS DEL CLIENTE:', { x: left, y, size: 12, font: fontBold }); y -= 16
  page.drawText(`Nombre: ${prestamo.cliente?.nombre || 'Desconocido'}`, { x: left + 20, y, size: 11, font: fontRegular }); y -= 20
  page.drawText('DETALLES DEL PRÉSTAMO:', { x: left, y, size: 12, font: fontBold }); y -= 16
  cDet.forEach((t) => { page.drawText(t, { x: left + 20, y, size: 11, font: fontRegular }); y -= 14 }); y -= 6
  page.drawText('OBSERVACIONES:', { x: left, y, size: 12, font: fontBold }); y -= 16
  const obs = prestamo.observaciones || 'Sin observaciones'
  const maxLW = right - left - 20; const words = obs.split(' '); let cl = ''
  for (const w of words) { const tl = cl ? `${cl} ${w}` : w; if (fontRegular.widthOfTextAtSize(tl, 11) > maxLW) { page.drawText(cl, { x: left + 20, y, size: 11, font: fontRegular }); y -= 14; cl = w } else { cl = tl } }
  if (cl) { page.drawText(cl, { x: left + 20, y, size: 11, font: fontRegular }); y -= 14 }; y -= 6
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: rgb(0, 0, 0), thickness: 1 }); y -= 10
  const fi = 'Copia interna — uso exclusivo del prestamista.'
  page.drawText(fi, { x: centerX - fontRegular.widthOfTextAtSize(fi, 9) / 2, y, size: 9, font: fontRegular }); y -= 12
  const gd = `Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`
  page.drawText(gd, { x: centerX - fontRegular.widthOfTextAtSize(gd, 9) / 2, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })
}

export async function handleGetPrestamoCashComprobante(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'ID de préstamo requerido' }, { status: 400 })
  const prestamo = await prisma.prestamoCash.findUnique({ where: { id }, include: { cliente: true, cuentaPorCobrar: true } })
  if (!prestamo) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica); const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  generateComprobantePDF(page, fontRegular, fontBold, prestamo)
  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="comprobante-PREST-${prestamo.idNumerico}.pdf"`, 'Content-Length': pdfBytes.length.toString() } })
}

export const prestamoCashPagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'), cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'), moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(), observaciones: z.string().optional()
})

export async function handlePostPrestamoCashPago(request: NextRequest, context: { params: Promise<{ id: string }> }, user: { userId: string }) {
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = prestamoCashPagoSchema.parse(await request.json())
  const prestamo = await prisma.prestamoCash.findFirst({ where: { id, deletedAt: null }, include: { cuentaPorCobrar: true } })
  if (!prestamo) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') return NextResponse.json({ error: 'El préstamo no admite más pagos' }, { status: 400 })
  const sp = calcularSaldoPendientePrestamo(Number(prestamo.cuentaPorCobrar.montoDeuda), Number(prestamo.cuentaPorCobrar.montoPagado))
  if (body.monto > sp) return NextResponse.json({ error: `El monto excede el saldo pendiente de ${sp}` }, { status: 400 })

  const resultado = await prisma.$transaction(async (tx: any) => {
     const moneda = body.moneda || prestamo.moneda
     const r = await tx.reconciliacionVenta.create({ data: { tenantId: prestamo.tenantId, cuentaId: body.cuentaId, tipoPagoId: body.tipoPagoId, monto: body.monto, moneda, ...buildPersistedAccountingAmount(body.monto, moneda, body.tasaCambio), ...(body.observaciones != null && { observaciones: body.observaciones }), reconciliadoPor: user.userId, prestamoCashId: prestamo.id, tipoReconciliacion: 'PRESTAMO_CASH' } })
    await tx.cuentaBancaria.update({ where: { cuentaId: body.cuentaId }, data: { saldo: { increment: body.monto } } })
    // Capa de contabilidad formal (CTA-1): cobro de préstamo.
    await postEvento(tx, { tenantId: prestamo.tenantId, userId: user.userId }, buildEventoCobroPrestamo({
      reconciliacionId: r.reconciliacionId,
      valoracion: { monto: body.monto, moneda },
      descripcion: body.observaciones || `Cobro de préstamo ${prestamo.id}`,
    }))
    const nmp = Number((Number(prestamo.cuentaPorCobrar.montoPagado) + body.monto).toFixed(2))
    const td = Number(prestamo.cuentaPorCobrar.montoDeuda); const ns = calcularSaldoPendientePrestamo(td, nmp); const nec = ns <= 0.01 ? 'PAGADA' : 'PARCIAL'
    await tx.cuentaPorCobrar.update({ where: { id: prestamo.cuentaPorCobrarId }, data: { montoPagado: nmp, estado: nec } })
    if (nec === 'PAGADA') await tx.prestamoCash.update({ where: { id: prestamo.id }, data: { estado: 'PAGADO' } })
    return r
  })

  await AuditLogService.log({ accion: 'CREATE', entidad: 'PAGO_PRESTAMO', entidadId: resultado.reconciliacionId, usuarioId: user.userId, detalles: { prestamoId: prestamo.id, monto: body.monto, moneda: body.moneda || prestamo.moneda } })
  return NextResponse.json({ reconciliacion: resultado }, { status: 201 })
}

function toNumber(v: unknown): number { return Number(v ?? 0) }

export async function handleGetPrestamoCashHistorial(context: { params: Promise<{ id: string }> }) {
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const prestamo = await prisma.prestamoCash.findFirst({ where: { id, deletedAt: null }, include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true } })
  if (!prestamo) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  const historial = await prisma.reconciliacionVenta.findMany({ where: { prestamoCashId: id, tipoReconciliacion: 'PRESTAMO_CASH' }, include: { cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' } })
  const mc = toNumber(prestamo.montoCapital); const td = toNumber(prestamo.cuentaPorCobrar.montoDeuda); const mp = toNumber(prestamo.cuentaPorCobrar.montoPagado)
  return NextResponse.json({
    prestamo: { ...prestamo, montoCapital: mc, tasaInteres: prestamo.tasaInteres != null ? toNumber(prestamo.tasaInteres) : null, cuentaPorCobrar: { ...prestamo.cuentaPorCobrar, montoDeuda: td, montoPagado: mp } },
    resumen: { montoCapital: mc, totalDeuda: td, montoPagado: mp, saldoPendiente: td - mp, cantidadPagos: historial.length },
    historial: historial.map((p: any) => ({ id: p.reconciliacionId, fecha: p.fechaReconciliacion, monto: toNumber(p.monto), moneda: p.moneda, tasaCambio: p.tasaCambio != null ? toNumber(p.tasaCambio) : null, montoConvertido: p.montoConvertido != null ? toNumber(p.montoConvertido) : null, observaciones: p.observaciones, tipoPago: p.tipoPago.nombre, cuentaBancaria: `${p.cuentaBancaria.nombreBanco} - ${p.cuentaBancaria.numeroCuenta}` }))
  })
}

export async function handleGetPrestamosCashStats() {
  if (!prestamosCashEnabled()) return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
  const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, cuentasPendientes, rm] = await Promise.all([
    prisma.prestamoCash.count({ where: { estado: 'ACTIVO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { estado: 'PAGADO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { estado: 'VENCIDO', deletedAt: null } }),
    prisma.prestamoCash.groupBy({ by: ['moneda'], where: { estado: { not: 'CANCELADO' }, deletedAt: null }, _sum: { montoCapital: true } }),
    prisma.cuentaPorCobrar.findMany({ where: { tipoCuenta: 'PRESTAMO_CASH', estado: { not: 'PAGADA' } }, select: { montoDeuda: true, montoPagado: true, prestamoCash: { select: { moneda: true } } } }),
    prisma.reconciliacionVenta.aggregate({ where: { tipoReconciliacion: 'PRESTAMO_CASH' }, _sum: { monto: true }, _avg: { monto: true } })
  ])
  const pendienteCobro: Record<string, number> = {}
  for (const c of cuentasPendientes) { const m = c.prestamoCash?.moneda ?? 'CUP'; pendienteCobro[m] = (pendienteCobro[m] ?? 0) + (Number(c.montoDeuda) - Number(c.montoPagado)) }
  const montoTotalPrestado: Record<string, number> = {}
  for (const g of montosPorMoneda) montoTotalPrestado[g.moneda] = Number(g._sum.montoCapital ?? 0)
  return NextResponse.json({ totalActivos, totalPagados, totalVencidos, montoTotalPrestado, montoPendienteCobro: pendienteCobro, resumenMovimientos: { totalPagos: Number(rm._sum.monto ?? 0), promedioPago: Number(rm._avg.monto ?? 0) } })
}
