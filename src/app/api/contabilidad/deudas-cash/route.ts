import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendienteDeuda, normalizarEstadoDeudaCash } from '@/lib/utils/deuda-cash'
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';

const querySchema = z.object({
  estado: z.enum(['ACTIVO', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  proveedorId: z.string().optional(),
  moneda: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
})

const createSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedorId es requerido'),
  montoCapital: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaInteresMoratorio: z.coerce.number().min(0).optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  comprobanteUrl: z.string().url().optional(),
  cuentaBancariaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
})

/** @description Resuelve la clave idempotente del cuerpo antes que la cabecera. */
function resolveIdempotencyKey(bodyKey: string | undefined, headerKey: string | null): string | undefined {
  if (bodyKey !== undefined) return bodyKey
  if (headerKey === null) return undefined
  const key = headerKey.trim()
  if (!key || key.length > 64) {
    throw new ActionError('La clave de idempotencia no es válida', 'VALIDATION_ERROR')
  }
  return key
}

/**
 * @description Verifica si el módulo de deudas cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false'
}

/**
 * @description Lista las deudas cash con filtros y paginación
 * @param {NextRequest} request - Request con query params: estado, proveedorId, moneda, page, limit
 * @returns {NextResponse} Lista paginada de deudas
 */
export const GET = withAuthGet(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar deudas cash');
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      estado: searchParams.get('estado') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      moneda: searchParams.get('moneda') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined
    })

    const skip = (query.page - 1) * query.limit

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
      ...(query.moneda ? { moneda: query.moneda } : {})
    }

    const [deudas, total] = await Promise.all([
      prisma.deudaCash.findMany({
        where,
        include: {
          proveedor: {
            select: {
              vendorId: true,
              nombre: true
            }
          },
          cuentaPorPagar: true,
          reconciliaciones: {
            include: {
              tipoPago: true,
              cuentaBancaria: true
            },
            orderBy: {
              fechaReconciliacion: 'desc'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.deudaCash.count({ where })
    ])

    const deudasNormalizadas = deudas.map((deuda) => ({
      ...deuda,
      estado: normalizarEstadoDeudaCash(deuda.estado, {
        montoDeuda: Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
        montoPagado: Number(deuda.cuentaPorPagar?.montoPagado ?? 0),
        estado: deuda.cuentaPorPagar?.estado,
      }),
      saldoPendiente: calcularSaldoPendienteDeuda(
        Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
        Number(deuda.cuentaPorPagar?.montoPagado ?? 0)
      )
    }))

    return NextResponse.json({
      deudas: deudasNormalizadas,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    })
  } catch (error) {
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error listando deudas cash:', error)
    return NextResponse.json({ error: 'Error listando deudas cash' }, { status: 500 })
  }
})

/**
 * @description Crea una deuda cash con su cuenta por pagar asociada en una transacción
 * @param {NextRequest} request - Request con body: proveedorId, montoCapital, moneda, tasaInteres?, fechaVencimiento?, observaciones?
 * @returns {NextResponse} Deuda creada con status 201
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear deudas cash');
    const rawBody = await request.json()
    const body = createSchema.parse(rawBody)
    const idempotencyKey = resolveIdempotencyKey(
      body.idempotencyKey,
      request.headers.get('idempotency-key'),
    )

    const input = {
      ...body,
      tasaInteres: body.tasaInteres ?? 0,
      tasaInteresMoratorio: body.tasaInteresMoratorio ?? 0,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }
    if (idempotencyKey) {
      const replay = await AccountingCashOperationsMutationService.findCashDebtCreateReplay({
        input,
        user,
      })
      if (replay) return NextResponse.json({ deuda: replay }, { status: 201 })
    }

    requireFeature(user, 'deudas-cash', 'crear deudas cash');

    // Preserve legacy date aliases for requests without replay keys; keyed requests use server time.
    const operationDate = idempotencyKey
      ? new Date()
      : extraerFechaDeBody(rawBody) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: operationDate,
      tenantId,
      tipoOperacion: 'deuda_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      if (idempotencyKey) {
        const replayAfterGate = await AccountingCashOperationsMutationService.findCashDebtCreateReplay({
          input,
          user,
        })
        if (replayAfterGate) return NextResponse.json({ deuda: replayAfterGate }, { status: 201 })
      }
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 },
      )
    }

    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input,
      user,
      operationDate,
    })
    return NextResponse.json({ deuda }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error creando deuda cash:', error)
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' || error.code === 'TENANT_REQUIRED' ? 403
        : error.code === 'NOT_FOUND' ? 404
          : error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    return NextResponse.json({ error: 'Error creando deuda cash' }, { status: 500 })
  }
})
