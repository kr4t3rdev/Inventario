/**
 * @description Adapter canónico para reconciliación de gastos.
 * Contiene toda la lógica de negocio: validación de referencias,
 * tasa de cambio, llamado al workflow y auditoría.
 * El route solo hace auth + period guard y delega aquí.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError,
} from '@/lib/services/pago-gastos-workflow'

// ─── Schema compartido ──────────────────────────────────────

export const reconciliacionGastoSchema = z.object({
  tipoGasto: z.enum(['salario', 'gastoDE', 'compra'], {
    errorMap: () => ({ message: 'Tipo de gasto debe ser: salario, gastoDE o compra' }),
  }),
  pgId: z.string().optional(),
  gastosDEId: z.string().optional(),
  gastoCompraId: z.string().optional(),
  referenciaId: z.string().optional(),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido').optional(),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido').optional(),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  descripcion: z.string().min(1, 'Descripción es requerida'),
  periodo: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).default('PAGADA'),
  cuentaPorPagarId: z.string().optional(),
  numeroTransaccion: z.string().optional(),
  distribucion: z
    .array(
      z.object({
        cuentaId: z.string(),
        monto: z.number().positive(),
        porcentaje: z.number().min(0).max(100).optional(),
      }),
    )
    .optional(),
})
  .refine(
    (data) => {
      const { tipoGasto, pgId, gastosDEId, gastoCompraId, referenciaId } = data
      if (tipoGasto === 'salario' && !(pgId || referenciaId)) return false
      if (tipoGasto === 'gastoDE' && !(gastosDEId || referenciaId)) return false
      if (tipoGasto === 'compra' && !(gastoCompraId || referenciaId)) return false
      return true
    },
    { message: 'Debe proporcionar el ID correspondiente al tipo de gasto' },
  )
  .refine(
    (data) => {
      const explicit = [data.pgId, data.gastosDEId, data.gastoCompraId].filter(Boolean)
      return explicit.length <= 1 && (!data.referenciaId || explicit.length === 0 || data.referenciaId === explicit[0])
    },
    { message: 'Debe proporcionar exactamente una referencia de gasto' },
  )
  .refine(
    (data) => {
      if (data.estado === 'PAGADA') {
        const hasDistribucion =
          Array.isArray(data.distribucion) && data.distribucion.length > 0
        const hasCuenta = !!data.cuentaId
        return hasDistribucion || hasCuenta
      }
      return true
    },
    {
      message: 'Debe indicar una cuenta bancaria o distribución multi-cuenta para pagar',
      path: ['cuentaId'],
    },
  )

export type ReconciliacionGastoInput = z.infer<typeof reconciliacionGastoSchema>

// ─── Resultado ──────────────────────────────────────────────

export interface ReconciliacionGastoResult {
  reconciliaciones: Array<{
    reconciliacionId: string
    cuentaId: string
    monto: number
    moneda: string
    montoConvertido: number | null
    descripcion: string
  }>
  cuentaPorPagar: {
    cuentaPorPagarId: string
    estado: string
    montoPagado: number
    saldoPendiente: number
  } | null
  pagoCuentaPorPagar: {
    pagoCuentaPorPagarId: string
    numeroTransaccion: string
    monto: number
  } | null
  distribucionMultiCuenta: boolean
}

// ─── Handler ────────────────────────────────────────────────

/**
 * @description Ejecuta toda la lógica de reconciliación de gastos:
 * validación de referencia, chequeo de duplicados, tasa de cambio,
 * workflow transaccional y auditoría.
 *
 * @param body - Raw request body (se parsea internamente)
 * @param user - Usuario autenticado con userId y tenantId
 * @returns Resultado estructurado de la reconciliación
 * @throws ZodError si falla validación de schema
 * @throws GastoWorkflowError si falla lógica de negocio
 */
export async function reconciliarGastoAdapter(
  body: unknown,
  user: AuthenticatedUser,
): Promise<ReconciliacionGastoResult> {
  const validatedData = reconciliacionGastoSchema.parse(body)
  const tenantId = requireTenant(user)

  // ── Verificar que la referencia existe según el tipo de gasto ──
  let referenciaExiste = false
  let referenciaId = ''
  let pgIdResolved: string | undefined
  let gastosDEIdResolved: string | undefined
  let gastoCompraIdResolved: string | undefined

  switch (validatedData.tipoGasto) {
    case 'salario': {
      const id = validatedData.pgId ?? validatedData.referenciaId
      if (!id) {
        throw Object.assign(new Error('Id de pago salario es requerido para gastos de salario'), {
          status: 400,
          code: 'EMPLEADO_ID_REQUERIDO',
        })
      }
      const pago = await prisma.pagosalario.findFirst({ where: { pgId: id, tenantId } })
      if (pago) {
        referenciaExiste = true
        referenciaId = id
        pgIdResolved = id
      }
      break
    }
    case 'gastoDE': {
      const id = validatedData.gastosDEId ?? validatedData.referenciaId
      if (!id) {
        throw Object.assign(new Error('gastosDEId es requerido para gastos DE'), {
          status: 400,
          code: 'GASTO_DE_ID_REQUERIDO',
        })
      }
      const gasto = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId } })
      if (gasto) {
        referenciaExiste = true
        referenciaId = id
        gastosDEIdResolved = id
      }
      break
    }
    case 'compra': {
      const id = validatedData.gastoCompraId ?? validatedData.referenciaId
      if (!id) {
        throw Object.assign(new Error('gastoCompraId es requerido para gastos de compra'), {
          status: 400,
          code: 'GASTO_COMPRA_ID_REQUERIDO',
        })
      }
      const compra = await prisma.gastoCompra.findFirst({ where: { gastoCompraId: id, tenantId } })
      if (compra) {
        referenciaExiste = true
        referenciaId = id
        gastoCompraIdResolved = id
      }
      break
    }
  }

  if (!referenciaExiste) {
    throw Object.assign(new Error(`${validatedData.tipoGasto} no encontrado`), {
      status: 404,
      code: 'REFERENCIA_NO_ENCONTRADA',
    })
  }

  // ── Verificar si ya está reconciliado (solo gastos sin CxP) ──
  if (!validatedData.cuentaPorPagarId) {
    const whereRec: any = {
      tenantId,
      tipoGasto: validatedData.tipoGasto,
      ...(validatedData.periodo && { periodo: validatedData.periodo }),
    }
    whereRec.referenciaId = referenciaId
    const existente = await prisma.reconciliacionGasto.findFirst({ where: whereRec })
    if (existente) {
      throw Object.assign(new Error('Este gasto ya ha sido reconciliado'), {
        status: 400,
        code: 'GASTO_YA_RECONCILIADO',
      })
    }
  }

  // ── Validación de tasa de cambio ──
  if (validatedData.distribucion && validatedData.distribucion.length > 0) {
    const cuentaIds = Array.from(new Set(validatedData.distribucion.map((d) => d.cuentaId)))
    if (cuentaIds.length > 0) {
      const cuentas = await prisma.cuentaBancaria.findMany({
        where: { cuentaId: { in: cuentaIds }, tenantId },
        select: { cuentaId: true, moneda: true },
      })
      const monedasDifieren = cuentas.some((c) => c.moneda !== validatedData.moneda)
      if (monedasDifieren && !validatedData.tasaCambio) {
        throw Object.assign(new Error('Tasa de cambio requerida por desajuste de moneda'), {
          status: 400,
          code: 'TASA_CAMBIO_REQUERIDA',
        })
      }
    }
  } else if (validatedData.cuentaId) {
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: validatedData.cuentaId, tenantId },
      select: { moneda: true },
    })
    if (cuenta && cuenta.moneda !== validatedData.moneda && !validatedData.tasaCambio) {
      throw Object.assign(new Error('Tasa de cambio requerida por desajuste de moneda'), {
        status: 400,
        code: 'TASA_CAMBIO_REQUERIDA',
      })
    }
  }

  // ── Workflow transaccional ──
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    return applyPagoGastoWorkflow(tx, {
      tipoGasto: validatedData.tipoGasto,
      referenciaId,
      reconciliadoPor: user.userId,
      descripcion: validatedData.descripcion,
      monto: Number(validatedData.monto),
      moneda: validatedData.moneda,
      tenantId,
      tasaCambio: validatedData.tasaCambio,
      periodo: validatedData.periodo,
      observaciones: validatedData.observaciones,
      estado: validatedData.estado,
      cuentaPorPagarId: validatedData.cuentaPorPagarId,
      numeroTransaccion: validatedData.numeroTransaccion,
      pgId: pgIdResolved,
      gastosDEId: gastosDEIdResolved,
      gastoCompraId: gastoCompraIdResolved,
      cuentaId: validatedData.cuentaId,
      tipoPagoId: validatedData.tipoPagoId,
      distribucion: validatedData.distribucion,
    })
  })

  // ── Audit log ──
  for (const rec of result.reconciliaciones) {
    try {
      await AuditLogService.log({
        accion: 'CREATE',
        entidad: 'RECONCILIACION',
        entidadId: rec.reconciliacionId,
        usuarioId: user.userId,
        detalles: {
          tipo: 'GASTO',
          tipoGasto: validatedData.tipoGasto,
          referenciaId,
          cuentaId: rec.cuentaId,
          monto: rec.monto,
          moneda: rec.moneda,
          montoConvertido: rec.montoConvertido,
          descripcion: rec.descripcion,
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría de reconciliación de gasto:', auditError)
    }
  }

  return {
    reconciliaciones: result.reconciliaciones,
    cuentaPorPagar: result.cuentaPorPagar,
    pagoCuentaPorPagar: result.pagoCuentaPorPagar,
    distribucionMultiCuenta: Boolean(validatedData.distribucion?.length),
  }
}
