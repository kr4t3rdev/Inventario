/**
 * @description Server Actions para Préstamos Cash.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { withPeriodValidation } from '@/lib/services/with-period-validation'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

function prestamosCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false' }

const createSchema = z.object({
  clienteId: z.string().min(1, 'El clienteId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida'),
})

const updateSchema = z.object({
  fechaVencimiento: z.string().optional(),
  tasaInteres: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
}).strict()

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
})

const PRESTAMO_INCLUDE = {
  cliente: { select: { clienteId: true, nombre: true } },
  cuentaPorCobrar: true,
  reconciliaciones: {
    include: { tipoPago: true, cuentaBancaria: true },
    orderBy: { fechaReconciliacion: 'desc' as const },
  },
} as const

export const getPrestamosCashAction = withAction(async (
  input: { estado?: string; clienteId?: string; moneda?: string; page?: number; limit?: number } = {},
  user: AuthenticatedUser
) => {
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)
  const page = input.page || 1
  const limit = input.limit || 20
  const skip = (page - 1) * limit

  const where: Record<string, any> = { tenantId, deletedAt: null }
  if (input.estado) where.estado = input.estado
  if (input.clienteId) where.clienteId = input.clienteId
  if (input.moneda) where.moneda = input.moneda

  const [prestamos, total] = await Promise.all([
    prisma.prestamoCash.findMany({
      where, include: PRESTAMO_INCLUDE,
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.prestamoCash.count({ where }),
  ])

  return {
    prestamos: prestamos.map((p) => ({
      ...p,
      estado: normalizarEstadoPrestamoCash(p.estado, {
        montoDeuda: Number(p.cuentaPorCobrar?.montoDeuda ?? p.montoCapital),
        montoPagado: Number(p.cuentaPorCobrar?.montoPagado ?? 0),
        estado: p.cuentaPorCobrar?.estado,
      }),
      saldoPendiente: calcularSaldoPendientePrestamo(
        Number(p.cuentaPorCobrar?.montoDeuda ?? p.montoCapital),
        Number(p.cuentaPorCobrar?.montoPagado ?? 0)
      ),
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})

export const getPrestamoCashByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)
  const prestamo = await prisma.prestamoCash.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
  })
  if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND')
  return prestamo
})

export const getPrestamoCashHistorialAction = withAction(async (id: string, user: AuthenticatedUser) => {
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)
  const prestamo = await prisma.prestamoCash.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
  })
  if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND')

  const historial = await prisma.reconciliacionVenta.findMany({
    where: { prestamoCashId: id, tipoReconciliacion: 'PRESTAMO_CASH' },
    include: {
      cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
      tipoPago: { select: { nombre: true } },
    },
    orderBy: { fechaReconciliacion: 'desc' },
  })

  const mc = Number(prestamo.montoCapital ?? 0)
  const td = Number(prestamo.cuentaPorCobrar.montoDeuda ?? 0)
  const mp = Number(prestamo.cuentaPorCobrar.montoPagado ?? 0)

  return {
    prestamo: {
      ...prestamo,
      montoCapital: mc,
      tasaInteres: prestamo.tasaInteres != null ? Number(prestamo.tasaInteres) : null,
      cuentaPorCobrar: { ...prestamo.cuentaPorCobrar, montoDeuda: td, montoPagado: mp },
    },
    resumen: {
      montoCapital: mc, totalDeuda: td, montoPagado: mp,
      saldoPendiente: td - mp, cantidadPagos: historial.length,
    },
    historial: historial.map((p: any) => ({
      id: p.reconciliacionId, fecha: p.fechaReconciliacion,
      monto: Number(p.monto ?? 0), moneda: p.moneda,
      tasaCambio: p.tasaCambio != null ? Number(p.tasaCambio) : null,
      montoConvertido: p.montoConvertido != null ? Number(p.montoConvertido) : null,
      observaciones: p.observaciones, tipoPago: p.tipoPago.nombre,
      cuentaBancaria: `${p.cuentaBancaria.nombreBanco} - ${p.cuentaBancaria.numeroCuenta}`,
    })),
  }
})

export const createPrestamoCashAction = withAction(withPeriodValidation(
  // Usa fecha actual para el desembolso
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
    const body = createSchema.parse(input)
    const tenantId = requireTenant(user)

    const cuentaOrigen = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: body.cuentaBancariaId },
      select: { cuentaId: true, saldo: true, isActive: true },
    })
    if (!cuentaOrigen || !cuentaOrigen.isActive) {
      throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR')
    }
    if (cuentaOrigen.saldo < body.montoCapital) {
      throw new ActionError(`Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}`, 'VALIDATION_ERROR')
    }

    const tp = (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true } }))
      || (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true } }))
    if (!tp) throw new ActionError('No existe un tipo de pago válido para registrar el desembolso', 'VALIDATION_ERROR')

    const prestamo = await prisma.$transaction(async (tx: any) => {
      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaBancariaId },
        data: { saldo: { decrement: body.montoCapital } },
      })

      const montoDeuda = body.tasaInteres
        ? Number((body.montoCapital * (1 + body.tasaInteres / 100)).toFixed(2))
        : body.montoCapital

      const cxcData: Record<string, unknown> = {
        tenant: { connect: { tenantId } }, cliente: { connect: { clienteId: body.clienteId } },
        montoDeuda, montoPagado: 0, tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
      }
      if (body.fechaVencimiento) cxcData.fechaVencimiento = new Date(body.fechaVencimiento)

      const cxc = await tx.cuentaPorCobrar.create({ data: cxcData })

      const reconciliacionData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: body.cuentaBancariaId } },
        tipoPago: { connect: { tipoId: tp.tipoId } }, monto: body.montoCapital,
        moneda: body.moneda,
        montoConvertido: body.tasaCambioAlCrear
          ? body.montoCapital * body.tasaCambioAlCrear : body.montoCapital,
        fechaReconciliacion: new Date(),
        observaciones: body.observaciones || `Desembolso de préstamo cash para cliente ${body.clienteId}`,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
      }
      if (body.tasaCambioAlCrear !== undefined) reconciliacionData.tasaCambio = body.tasaCambioAlCrear

      await tx.reconciliacionVenta.create({ data: reconciliacionData })

      const prestamoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: body.clienteId } },
        cuentaPorCobrar: { connect: { id: cxc.id } },
        montoCapital: body.montoCapital, moneda: body.moneda,
        createdById: user.userId,
      }
      if (body.cuentaBancariaId) prestamoData.cuentaBancariaId = body.cuentaBancariaId
      if (body.tasaInteres !== undefined) prestamoData.tasaInteres = body.tasaInteres
      if (body.tasaCambioAlCrear !== undefined) prestamoData.tasaCambioAlCrear = body.tasaCambioAlCrear
      if (body.fechaVencimiento) prestamoData.fechaVencimiento = new Date(body.fechaVencimiento)
      if (body.observaciones) prestamoData.observaciones = body.observaciones

      return tx.prestamoCash.create({
        data: prestamoData,
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      })
    })

    await AuditLogService.log({
      accion: 'CREATE', entidad: 'PRESTAMO_CASH', entidadId: prestamo.id, usuarioId: user.userId,
      detalles: { clienteId: body.clienteId, montoCapital: body.montoCapital, moneda: body.moneda },
    })

    revalidatePath('/busy/contabilidad/prestamos-cash')
    return prestamo
  }
));

export const updatePrestamoCashAction = withAction(async (
  input: { id: string } & z.infer<typeof updateSchema>,
  user: AuthenticatedUser
) => {
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  const { id, ...data } = input
  const parsed = updateSchema.parse(data)
  const existing = await prisma.prestamoCash.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND')

  const prestamo = await prisma.prestamoCash.update({
    where: { id },
    data: {
      ...(parsed.fechaVencimiento ? { fechaVencimiento: new Date(parsed.fechaVencimiento) } : {}),
      ...(parsed.tasaInteres !== undefined ? { tasaInteres: parsed.tasaInteres } : {}),
      ...(parsed.observaciones !== undefined ? { observaciones: parsed.observaciones } : {}),
    },
    include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
  })

  await AuditLogService.log({
    accion: 'UPDATE', entidad: 'PRESTAMO_CASH', entidadId: id, usuarioId: user.userId,
    detalles: { cambios: data },
  })

  revalidatePath('/busy/contabilidad/prestamos-cash')
  return prestamo
})

export const registrarPagoPrestamoAction = withAction(withPeriodValidation(
  // Usa fecha actual para el pago
  () => new Date(),
  async (
    input: { id: string } & z.infer<typeof pagoSchema>,
    user: AuthenticatedUser
  ) => {
    if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
    const {
    // @ts-expect-error
    id, ...body
    } = pagoSchema.parse(input)
    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, deletedAt: null },
      include: { cuentaPorCobrar: true },
    })
    if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND')
    if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') {
      throw new ActionError('El préstamo no admite más pagos', 'VALIDATION_ERROR')
    }
    const sp = calcularSaldoPendientePrestamo(
      Number(prestamo.cuentaPorCobrar.montoDeuda),
      Number(prestamo.cuentaPorCobrar.montoPagado)
    )
    if (body.monto > sp) {
      throw new ActionError(`El monto excede el saldo pendiente de ${sp}`, 'VALIDATION_ERROR')
    }

    const tenantId = requireTenant(user)
    const resultado = await prisma.$transaction(async (tx: any) => {
      const pagoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: body.cuentaId } },
        tipoPago: { connect: { tipoId: body.tipoPagoId } },
        prestamoCash: { connect: { id: prestamo.id } },
        monto: body.monto,
        moneda: body.moneda || prestamo.moneda,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH',
      }
      if (body.tasaCambio != null) pagoData.tasaCambio = body.tasaCambio
      if (body.observaciones != null) pagoData.observaciones = body.observaciones

      const r = await tx.reconciliacionVenta.create({ data: pagoData })
      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaId },
        data: { saldo: { increment: body.monto } },
      })
      const nmp = Number((Number(prestamo.cuentaPorCobrar.montoPagado) + body.monto).toFixed(2))
      const td = Number(prestamo.cuentaPorCobrar.montoDeuda)
      const ns = calcularSaldoPendientePrestamo(td, nmp)
      const nec = ns <= 0.01 ? 'PAGADA' : 'PARCIAL'
      await tx.cuentaPorCobrar.update({
        where: { id: prestamo.cuentaPorCobrarId },
        data: { montoPagado: nmp, estado: nec },
      })
      if (nec === 'PAGADA') {
        await tx.prestamoCash.update({ where: { id: prestamo.id }, data: { estado: 'PAGADO' } })
      }
      return r
    })

    await AuditLogService.log({
      accion: 'CREATE', entidad: 'PAGO_PRESTAMO', entidadId: resultado.reconciliacionId, usuarioId: user.userId,
      detalles: { prestamoId: prestamo.id, monto: body.monto, moneda: body.moneda || prestamo.moneda },
    })

    revalidatePath('/busy/contabilidad/prestamos-cash')
    return { reconciliacion: resultado }
  }
));

export const getPrestamosCashStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  requireTenant(user)

  const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, cuentasPendientes, rm] = await Promise.all([
    prisma.prestamoCash.count({ where: { estado: 'ACTIVO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { estado: 'PAGADO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { estado: 'VENCIDO', deletedAt: null } }),
    prisma.prestamoCash.groupBy({
      by: ['moneda'],
      where: { estado: { not: 'CANCELADO' }, deletedAt: null },
      _sum: { montoCapital: true },
    }),
    prisma.cuentaPorCobrar.findMany({
      where: { tipoCuenta: 'PRESTAMO_CASH', estado: { not: 'PAGADA' } },
      select: { montoDeuda: true, montoPagado: true, prestamoCash: { select: { moneda: true } } },
    }),
    prisma.reconciliacionVenta.aggregate({
      where: { tipoReconciliacion: 'PRESTAMO_CASH' },
      _sum: { monto: true },
      _avg: { monto: true },
    }),
  ])

  const montoPendienteCobro: Record<string, number> = {}
  for (const c of cuentasPendientes) {
    const m = c.prestamoCash?.moneda ?? 'CUP'
    montoPendienteCobro[m] = (montoPendienteCobro[m] ?? 0) + (Number(c.montoDeuda) - Number(c.montoPagado))
  }
  const montoTotalPrestado: Record<string, number> = {}
  for (const g of montosPorMoneda) {
    montoTotalPrestado[g.moneda] = Number(g._sum.montoCapital ?? 0)
  }

  return {
    totalActivos, totalPagados, totalVencidos,
    montoTotalPrestado, montoPendienteCobro,
    resumenMovimientos: {
      totalPagos: Number(rm._sum.monto ?? 0),
      promedioPago: Number(rm._avg.monto ?? 0),
    },
  }
})
