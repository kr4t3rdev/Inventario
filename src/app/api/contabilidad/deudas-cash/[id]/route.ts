import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ActionError } from '@/lib/server-actions'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { hasFeature, hasPermission, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { AuditLogService } from '@/lib/services/audit-log-service'

const updateSchema = z.object({
  fechaVencimiento: z.string().optional(),
  tasaInteres: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
  montoCapital: z.never().optional(),
  moneda: z.never().optional()
}).strict()

/**
 * @description Verifica si el módulo de deudas cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false'
}

/**
 * @description Obtiene una deuda cash por ID con proveedor y cuenta por pagar
 * @param {NextRequest} request - Request
 * @returns {NextResponse} Deuda encontrada o 404
 */
export const GET = withAuthGet(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar deudas cash')
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

    const deuda = await prisma.deudaCash.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        proveedor: {
          select: {
            vendorId: true,
            nombre: true
          }
        },
        cuentaPorPagar: true
      }
    })

    if (!deuda) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ deuda })
  } catch (error) {
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    console.error('Error obteniendo deuda cash:', error)
    return NextResponse.json({ error: 'Error obteniendo deuda cash' }, { status: 500 })
  }
})

/**
 * @description Actualiza campos permitidos de una deuda cash (fechaVencimiento, tasaInteres, observaciones)
 * @param {NextRequest} request - Request con body de campos a actualizar
 * @returns {NextResponse} Deuda actualizada
 */
export const PUT = withAuthPost(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user)
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

    if (!hasPermission(user, 'financiero.contabilidad.acceder')) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar esta deuda', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    if (!hasFeature(user, 'deudas-cash')) {
      return NextResponse.json(
        { error: 'La edición de deudas cash no está disponible en el plan actual', code: 'FEATURE_NOT_AVAILABLE' },
        { status: 403 },
      )
    }

    const body = await request.json()

    // Validar período contable
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'deuda_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    if (body.montoCapital !== undefined || body.moneda !== undefined) {
      return NextResponse.json(
        { error: 'No se permite modificar montoCapital ni moneda de una deuda existente' },
        { status: 400 }
      )
    }

    const data = updateSchema.parse(body)

    const existing = await prisma.deudaCash.findFirst({
      where: { id, tenantId, deletedAt: null }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
    }

    const deuda = await prisma.deudaCash.update({
      where: { id, tenantId },
      data: {
        ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}),
        ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}),
        ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
      },
      include: {
        proveedor: {
          select: {
            vendorId: true,
            nombre: true
          }
        },
        cuentaPorPagar: true
      }
    })

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'DEUDA_CASH',
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        cambios: {
          ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: deuda.fechaVencimiento } } : {}),
          ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(deuda.tasaInteres) } } : {}),
          ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: deuda.observaciones } } : {})
        }
      }
    })

    return NextResponse.json({ deuda })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error actualizando deuda cash:', error)
    return NextResponse.json({ error: 'Error actualizando deuda cash' }, { status: 500 })
  }
})
