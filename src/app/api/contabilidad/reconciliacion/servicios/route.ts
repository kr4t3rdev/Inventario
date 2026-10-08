import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { ActionError } from '@/lib/server-actions'
import { extraerFechaDeBody, validarEscrituraPeriodo } from '@/lib/services/validate-period-write'
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service'

const reconciliacionServicioSchema = z.object({
  ventaServicioId: z.string().min(1, 'ID de venta de servicio es requerido'),
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido'),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido'),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  tasaEfectivaEn: z.string().datetime().optional(),
  fechaReconciliacion: z.string().datetime().optional(),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

/** @description Obtiene los servicios pendientes del tenant autenticado. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request)
    if ('status' in auth) return auth as Response
    const tenantId = requireTenant(auth.user)
    requireFeature(auth.user, 'servicios', 'ver reconciliación de servicios')

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const page = Number.parseInt(searchParams.get('page') || '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const where: Prisma.VentaServiciosWhereInput = {
      tenantId,
      servicio: { is: { tenantId } },
      AND: [{ OR: [{ clienteId: null }, { cliente: { is: { tenantId } } }] }],
    }
    if (fechaDesde || fechaHasta) {
      where.createdAt = {
        ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}),
        ...(fechaHasta ? { lte: new Date(fechaHasta) } : {}),
      }
    }

    const skip = (page - 1) * limit
    const [ventaServicios, total] = await Promise.all([
      prisma.ventaServicios.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cliente: true,
          servicio: true,
          reconciliaciones: {
            where: { tenantId },
            select: { montoConvertido: true },
          },
        },
      }),
      prisma.ventaServicios.count({ where }),
    ])

    return NextResponse.json({
      ventaServicios,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching pending services:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

/** @description Reconcile a service receipt using the shared accounting writer. */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateUser(request)
    if ('status' in auth) return auth as Response
    const user = auth.user
    const tenantId = requireTenant(user)
    requireFeature(user, 'servicios', 'reconciliar servicios')
    requirePermission(user, 'financiero.contabilidad.acceder', 'reconciliar servicios')

    const body = await request.json()
    const input = reconciliacionServicioSchema.parse(body)
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'reconciliacion_servicios',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        {
          error: validacionPeriodo.error?.message ?? 'Período contable cerrado',
          code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO',
        },
        { status: 400 },
      )
    }

    const result = await AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: input.ventaServicioId,
        ...(input.fechaReconciliacion
          ? { fechaReconciliacion: input.fechaReconciliacion }
          : {}),
        idempotencyKey: input.idempotencyKey ??
          request.headers.get('Idempotency-Key') ?? undefined,
        distribuciones: [{
          cuentaId: input.cuentaId,
          tipoPagoId: input.tipoPagoId,
          monto: input.monto,
          moneda: input.moneda,
          tasaCambio: input.tasaCambio,
          fechaTasa: input.tasaEfectivaEn,
          observaciones: input.observaciones,
        }],
      },
    })

    return NextResponse.json({
      ...result,
      message: 'Servicio reconciliado exitosamente',
      ...(result.reconciliaciones[0]
        ? { reconciliacion: result.reconciliaciones[0] }
        : {}),
    }, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE'
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'IDEMPOTENCY_CONFLICT'
            ? 409
          : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 },
      )
    }

    console.error('Error reconciling service:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
