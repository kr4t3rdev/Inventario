/**
 * @description Server Actions para Deudas Cash.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAction, ActionError } from '@/lib/server-actions'
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { withPeriodValidation } from '@/lib/services/with-period-validation'
import { cloudinaryAssetSchema } from '@/lib/upload/cloudinary-asset'
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin'
import { calcularSaldoPendienteDeuda, calcularTotalDeudaConInteres, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service'
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service'

function deudasCashEnabled(): boolean { return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false' }

const createSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedorId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  comprobanteUrl: z.string().optional(),
  comprobanteAsset: cloudinaryAssetSchema.optional().nullable(),
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
  requireFeature(user, 'deudas-cash', 'gestionar deudas cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.listCashDebts({
    tenantId,
    estado: input.estado ?? null,
    proveedorId: input.proveedorId ?? null,
    moneda: input.moneda ?? null,
    page: input.page,
    limit: input.limit,
  })
})

export const getDeudaCashByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'deudas-cash', 'consultar deudas cash');
  const tenantId = requireTenant(user)
  return AccountingCashOperationsService.getCashDebtById({ tenantId, id })
})

export const createDeudaCashAction = withAction(withPeriodValidation(
  // Usa fecha actual para el desembolso
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'deudas-cash', 'crear deudas cash');
    const body = createSchema.parse(input)
    const tenantId = requireTenant(user)
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: body,
      user,
    })
    if (body.comprobanteAsset) {
      await recordOwnerAsset({
        tenantId,
        ownerType: 'deudaCash',
        ownerId: deuda.id,
        slot: 'receipt',
        asset: body.comprobanteAsset,
      })
    }
    revalidatePath('/busy/contabilidad/deudas-cash')
    return deuda
  }
));

export const updateDeudaCashAction = withAction(async (
  input: { id: string } & z.infer<typeof updateSchema>,
  user: AuthenticatedUser
) => {
  requireFeature(user, 'deudas-cash', 'editar deudas cash');
  const { id, ...data } = input
  const parsed = updateSchema.parse(data)
  const deuda = await AccountingCashOperationsMutationService.updateCashDebt({
    input: { id, ...parsed },
    user,
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
    requireFeature(user, 'deudas-cash', 'registrar pagos de deudas cash');
    const {
    // @ts-expect-error Zod infers the intersection without preserving the external id field in destructuring.
    id, ...body
    } = pagoSchema.parse(input)
    const resultado = await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: { id, ...body },
      user,
    })
    revalidatePath('/busy/contabilidad/deudas-cash')
    return { reconciliacion: resultado }
  }
));

export const getDeudasCashStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'deudas-cash', 'ver estadísticas de deudas cash');
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
