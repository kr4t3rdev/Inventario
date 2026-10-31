/**
 * @description Server Actions para Préstamos Cash.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { withPeriodValidation } from '@/lib/services/with-period-validation'
import {
  isCashCreateIdempotencyUniqueConflict,
  runCashCreateWithReplay,
} from '@/lib/services/cash-create-idempotency'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service'
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service'

function prestamosCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false' }

const createSchema = z.object({
  clienteId: z.string().min(1, 'El clienteId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0),
  tasaInteresMoratorio: z.coerce.number().min(0),
  tasaCambioAlCrear: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
})

const updateSchema = z.object({
  fechaVencimiento: z.string().optional(),
  tasaInteres: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
}).strict()

const pagoSchema = z.object({
  id: z.string().min(1),
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
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
  requirePermission(user, 'financiero.contabilidad.acceder', 'consultar préstamos cash');
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
  requirePermission(user, 'financiero.contabilidad.acceder', 'consultar préstamos cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.getCashLoanById({ tenantId, id })
})

export const getPrestamoCashHistorialAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requirePermission(user, 'financiero.contabilidad.acceder', 'consultar historial de préstamos cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.getCashLoanHistory({ tenantId, id })
})

export const createPrestamoCashAction = withAction(async (
  input: z.infer<typeof createSchema>,
  user: AuthenticatedUser
) => {
  requirePermission(user, 'financiero.contabilidad.acceder', 'crear préstamos cash');
  requireTenant(user);
  const body = createSchema.parse(input)
  const operationDate = new Date()
  const prestamo = await runCashCreateWithReplay({
    findReplay: () => AccountingCashOperationsMutationService.findCashLoanCreateReplay({
      input: body,
      user,
    }),
    validatePeriod: async () => {
      requireFeature(user, 'prestamos-cash', 'crear préstamos cash');
      return withPeriodValidation(
        () => operationDate,
        async () => undefined,
      )(undefined, user);
    },
    write: () => AccountingCashOperationsMutationService.createCashLoan({
      input: body,
      user,
      operationDate,
    }),
    canRecover: (error) => {
      if (error instanceof ActionError && [
        'PERIODO_CERRADO',
        'PERIODO_APROBADO',
        'PERIODO_EN_CIERRE',
      ].includes(error.code ?? '')) return true
      return isCashCreateIdempotencyUniqueConflict(error)
    },
  })
  revalidatePath('/busy/contabilidad/prestamos-cash')
  return prestamo
})

export const updatePrestamoCashAction = withAction(async (
  input: { id: string } & z.infer<typeof updateSchema>,
  user: AuthenticatedUser
) => {
  requirePermission(user, 'financiero.contabilidad.acceder', 'editar préstamos cash');
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

export const registrarPagoPrestamoAction = withAction(async (
  input: { id: string } & z.infer<typeof pagoSchema>,
  user: AuthenticatedUser
) => {
  requirePermission(user, 'financiero.contabilidad.acceder', 'registrar pagos de préstamos cash');
  const { id, ...body } = pagoSchema.parse(input);
  const paymentInput = { id, ...body };
  const resultado = await runCashCreateWithReplay({
    findReplay: () => AccountingCashOperationsMutationService.findCashLoanPaymentReplay({
      input: paymentInput,
      user,
    }),
    validatePeriod: () => withPeriodValidation(
      () => new Date(),
      async () => undefined,
    )(paymentInput, user),
    write: () => AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: paymentInput,
      user,
    }),
    canRecover: (error) =>
      isCashCreateIdempotencyUniqueConflict(error) ||
      (error instanceof ActionError && error.code.startsWith('PERIODO_')),
  });
  revalidatePath('/busy/contabilidad/prestamos-cash');
  return { reconciliacion: resultado };
});

export const getPrestamosCashStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requirePermission(user, 'financiero.contabilidad.acceder', 'consultar estadísticas de préstamos cash');
  if (!prestamosCashEnabled()) throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED')
  const tenantId = requireTenant(user)

  const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, cuentasPendientes, rm] = await Promise.all([
    prisma.prestamoCash.count({ where: { tenantId, estado: 'ACTIVO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { tenantId, estado: 'PAGADO', deletedAt: null } }),
    prisma.prestamoCash.count({ where: { tenantId, estado: 'VENCIDO', deletedAt: null } }),
    prisma.prestamoCash.groupBy({
      by: ['moneda'],
      where: { tenantId, estado: { not: 'CANCELADO' }, deletedAt: null },
      _sum: { montoCapital: true },
    }),
    prisma.cuentaPorCobrar.findMany({
      where: { tenantId, tipoCuenta: 'PRESTAMO_CASH', estado: { not: 'PAGADA' } },
      select: { montoDeuda: true, montoPagado: true, prestamoCash: { select: { moneda: true } } },
    }),
    prisma.reconciliacionVenta.aggregate({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH' },
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
