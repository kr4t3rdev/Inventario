/**
 * @description Server Actions para Deudas Cash.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { withPeriodValidation } from '@/lib/services/with-period-validation'
import { calcularSaldoPendienteDeuda, calcularTotalDeudaConInteres, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

function deudasCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false' }

const createSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedorId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  comprobanteUrl: z.string().optional(),
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

const DEUDA_INCLUDE = {
  proveedor: { select: { vendorId: true, nombre: true } },
  cuentaPorPagar: true,
  reconciliaciones: {
    include: { tipoPago: true, cuentaBancaria: true },
    orderBy: { fechaReconciliacion: 'desc' as const },
  },
} as const

export const getDeudasCashAction = withAction(async (
  input: { estado?: string; proveedorId?: string; moneda?: string; page?: number; limit?: number } = {},
  user: AuthenticatedUser
) => {
  if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)
  const page = input.page || 1
  const limit = input.limit || 20
  const skip = (page - 1) * limit

  const where: Record<string, any> = { tenantId, deletedAt: null }
  if (input.estado) where.estado = input.estado
  if (input.proveedorId) where.proveedorId = input.proveedorId
  if (input.moneda) where.moneda = input.moneda

  const [deudas, total] = await Promise.all([
    prisma.deudaCash.findMany({
      where, include: DEUDA_INCLUDE,
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.deudaCash.count({ where }),
  ])

  return {
    deudas: deudas.map((d) => ({
      ...d,
      estado: normalizarEstadoDeudaCash(d.estado, {
        montoDeuda: Number(d.cuentaPorPagar?.montoDeuda ?? d.montoCapital),
        montoPagado: Number(d.cuentaPorPagar?.montoPagado ?? 0),
        estado: d.cuentaPorPagar?.estado,
      }),
      saldoPendiente: calcularSaldoPendienteDeuda(
        Number(d.cuentaPorPagar?.montoDeuda ?? d.montoCapital),
        Number(d.cuentaPorPagar?.montoPagado ?? 0)
      ),
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})

export const getDeudaCashByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)
  const deuda = await prisma.deudaCash.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
  })
  if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND')
  return deuda
})

export const createDeudaCashAction = withAction(withPeriodValidation(
  // Usa fecha actual para el desembolso
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
    const body = createSchema.parse(input)
    const tenantId = requireTenant(user)
    const totalDeuda = calcularTotalDeudaConInteres(body.montoCapital, body.tasaInteres)

    const proveedor = await prisma.vendor.findUnique({ where: { vendorId: body.proveedorId }, select: { nombre: true } })
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND')

    const deuda = await prisma.$transaction(async (tx: any) => {
      const tp = (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true } }))
        || (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true } }))
      if (!tp) throw new ActionError('No existe un tipo de pago válido para el desembolso de deuda', 'VALIDATION_ERROR')

      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaBancariaId },
        data: { saldo: { increment: body.montoCapital } },
      })

      const lastDeuda = await tx.deudaCash.findFirst({ orderBy: { idNumerico: 'desc' }, select: { idNumerico: true } })
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1

      const cxp = await tx.cuentaPorPagar.create({
        data: {
          tenantId, numeroFactura: `DC-${nextNum}`, proveedorId: body.proveedorId,
          proveedorNombre: proveedor.nombre, montoDeuda: totalDeuda, montoPagado: 0,
          saldoPendiente: totalDeuda, moneda: body.moneda, tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH', estado: 'PENDIENTE',
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
        },
      })

      await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: body.cuentaBancariaId } },
          tipoPago: { connect: { tipoId: tp.tipoId } },
          monto: body.montoCapital,
          moneda: body.moneda, montoConvertido: body.montoCapital,
          fechaReconciliacion: new Date(),
          observaciones: body.observaciones || `Desembolso de deuda cash para proveedor ${body.proveedorId}`,
          reconciliadoPor: user.userId,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
        },
      })

      return tx.deudaCash.create({
        data: {
          tenantId, proveedorId: body.proveedorId,
          cuentaPorPagarId: cxp.cuentaPorPagarId, montoCapital: body.montoCapital,
          moneda: body.moneda, tasaInteres: body.tasaInteres,
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
          observaciones: body.observaciones, comprobanteUrl: body.comprobanteUrl,
          cuentaBancariaId: body.cuentaBancariaId, createdById: user.userId,
        },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      })
    })

    await AuditLogService.log({
      accion: 'CREATE', entidad: 'DEUDA_CASH', entidadId: deuda.id, usuarioId: user.userId,
      detalles: { proveedorId: body.proveedorId, montoCapital: body.montoCapital, moneda: body.moneda },
    })

    revalidatePath('/busy/contabilidad/deudas-cash')
    return deuda
  }
));

export const updateDeudaCashAction = withAction(async (
  input: { id: string } & z.infer<typeof updateSchema>,
  user: AuthenticatedUser
) => {
  if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
  const { id, ...data } = input
  const parsed = updateSchema.parse(data)
  const existing = await prisma.deudaCash.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw new ActionError('Deuda no encontrada', 'NOT_FOUND')

  const deuda = await prisma.deudaCash.update({
    where: { id },
    data: {
      ...(parsed.fechaVencimiento ? { fechaVencimiento: new Date(parsed.fechaVencimiento) } : {}),
      ...(parsed.tasaInteres !== undefined ? { tasaInteres: parsed.tasaInteres } : {}),
      ...(parsed.observaciones !== undefined ? { observaciones: parsed.observaciones } : {}),
    },
    include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
  })

  await AuditLogService.log({
    accion: 'UPDATE', entidad: 'DEUDA_CASH', entidadId: id, usuarioId: user.userId,
    detalles: { cambios: data },
  })

  revalidatePath('/busy/contabilidad/deudas-cash')
  return deuda
})

export const registrarPagoDeudaAction = withAction(withPeriodValidation(
  // Usa fecha actual para el pago
  () => new Date(),
  async (
    input: { id: string } & z.infer<typeof pagoSchema>,
    user: AuthenticatedUser
  ) => {
    if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
    const tenantId = requireTenant(user)
    const {
    // @ts-expect-error
    id, ...body
    } = pagoSchema.parse(input)
    const deuda = await prisma.deudaCash.findFirst({
      where: { id, deletedAt: null },
      include: { cuentaPorPagar: true },
    })
    if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND')
    if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
      throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR')
    }
    const sp = calcularSaldoPendienteDeuda(
      Number(deuda.cuentaPorPagar.montoDeuda),
      Number(deuda.cuentaPorPagar.montoPagado)
    )
    if (body.monto > sp) {
      throw new ActionError(`El monto excede el saldo pendiente de ${sp}`, 'VALIDATION_ERROR')
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      const r = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: body.cuentaId } },
          tipoPago: { connect: { tipoId: body.tipoPagoId } },
          monto: body.monto,
          moneda: body.moneda || deuda.moneda,
          ...(body.tasaCambio != null && { tasaCambio: body.tasaCambio }),
          ...(body.observaciones != null && { observaciones: body.observaciones }),
          reconciliadoPor: user.userId, deudaCash: { connect: { id: deuda.id } },
          tipoReconciliacion: 'DEUDA_CASH',
        },
      })
      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaId },
        data: { saldo: { decrement: body.monto } },
      })
      const nmp = Number((Number(deuda.cuentaPorPagar.montoPagado) + body.monto).toFixed(2))
      const td = Number(deuda.cuentaPorPagar.montoDeuda)
      const nsp = calcularSaldoPendienteDeuda(td, nmp)
      const nec = nsp <= 0.01 ? 'PAGADA' : 'PARCIAL'
      await tx.cuentaPorPagar.update({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
        data: { montoPagado: nmp, saldoPendiente: nsp, estado: nec },
      })
      if (nec === 'PAGADA') {
        await tx.deudaCash.update({ where: { id: deuda.id }, data: { estado: 'PAGADO' } })
      }
      return r
    })

    await AuditLogService.log({
      accion: 'CREATE', entidad: 'PAGO_DEUDA', entidadId: resultado.reconciliacionId, usuarioId: user.userId,
      detalles: { deudaId: deuda.id, monto: body.monto, moneda: body.moneda || deuda.moneda },
    })

    revalidatePath('/busy/contabilidad/deudas-cash')
    return { reconciliacion: resultado }
  }
));

export const getDeudasCashStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (!deudasCashEnabled()) throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED')
  requireTenant(user)

  const [totalActivas, totalPagadas, totalVencidas, montosPorMoneda] = await Promise.all([
    prisma.deudaCash.count({ where: { estado: 'ACTIVO', deletedAt: null } }),
    prisma.deudaCash.count({ where: { estado: 'PAGADO', deletedAt: null } }),
    prisma.deudaCash.count({ where: { estado: 'VENCIDO', deletedAt: null } }),
    prisma.deudaCash.groupBy({
      by: ['moneda'],
      where: { estado: { not: 'CANCELADO' }, deletedAt: null },
      _sum: { montoCapital: true },
    }),
  ])

  const cuentasPendientes = await prisma.cuentaPorPagar.findMany({
    where: { tipoDeuda: 'DEUDA_CASH', estado: { not: 'PAGADA' } },
    select: { montoDeuda: true, montoPagado: true, deudaCash: { select: { moneda: true } } },
  })
  const montoPendientePago: Record<string, number> = {}
  for (const c of cuentasPendientes) {
    const m = c.deudaCash?.moneda ?? 'CUP'
    montoPendientePago[m] = (montoPendientePago[m] ?? 0) + (Number(c.montoDeuda) - Number(c.montoPagado))
  }
  const montoTotalDeuda: Record<string, number> = {}
  for (const g of montosPorMoneda) {
    montoTotalDeuda[g.moneda] = Number(g._sum.montoCapital ?? 0)
  }

  return { totalActivas, totalPagadas, totalVencidas, montoTotalDeuda, montoPendientePago }
})
