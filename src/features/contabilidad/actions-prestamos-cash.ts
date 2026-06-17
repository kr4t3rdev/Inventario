/**
 * @description Server Actions para Préstamos Cash.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { withPeriodValidation } from '@/lib/services/with-period-validation'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service'
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service'

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
  requireFeature(user, 'prestamos-cash', 'gestionar préstamos cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.listCashLoans({
    tenantId,
    estado: input.estado ?? null,
    clienteId: input.clienteId ?? null,
    moneda: input.moneda ?? null,
    page: input.page,
    limit: input.limit,
  })
})

export const getPrestamoCashByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'prestamos-cash', 'consultar préstamos cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.getCashLoanById({ tenantId, id })
})

export const getPrestamoCashHistorialAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'prestamos-cash', 'consultar historial de préstamos cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.getCashLoanHistory({ tenantId, id })
})

export const createPrestamoCashAction = withAction(withPeriodValidation(
  // Usa fecha actual para el desembolso
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'prestamos-cash', 'crear préstamos cash');
    const body = createSchema.parse(input)
    const prestamo = await AccountingCashOperationsMutationService.createCashLoan({
      input: body,
      user,
    })
    revalidatePath('/busy/contabilidad/prestamos-cash')
    return prestamo
  }
));

export const updatePrestamoCashAction = withAction(async (
  input: { id: string } & z.infer<typeof updateSchema>,
  user: AuthenticatedUser
) => {
  requireFeature(user, 'prestamos-cash', 'editar préstamos cash');
  const { id, ...data } = input
  const parsed = updateSchema.parse(data)
  const prestamo = await AccountingCashOperationsMutationService.updateCashLoan({
    input: { id, ...parsed },
    user,
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
    requireFeature(user, 'prestamos-cash', 'registrar pagos de préstamos cash');
    const {
    // @ts-expect-error Zod infers the intersection without preserving the external id field in destructuring.
    id, ...body
    } = pagoSchema.parse(input)
    const resultado = await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: { id, ...body },
      user,
    })
    revalidatePath('/busy/contabilidad/prestamos-cash')
    return { reconciliacion: resultado }
  }
));

export const getPrestamosCashStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'prestamos-cash', 'ver estadísticas de préstamos cash');
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
