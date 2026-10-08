import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
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

    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const tenantId = requireTenant(user)
    requireFeature(user, 'deudas-cash', 'consultar deudas cash')
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar deudas cash')

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
    console.error('Error obteniendo deuda cash:', error)
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
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
    requireFeature(user, 'deudas-cash', 'actualizar deudas cash')
    requirePermission(user, 'financiero.contabilidad.acceder', 'actualizar deudas cash')
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

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

    const deuda = await prisma.$transaction(async (tx) => {
      const existing = await tx.deudaCash.findFirst({ where: { id, tenantId, deletedAt: null } })
      if (!existing) return null

      const updated = await tx.deudaCash.updateMany({
        where: { id, tenantId, deletedAt: null },
        data: {
          ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}),
          ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}),
          ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
        }
      })
      if (updated.count !== 1) return null

      const deudaActualizada = await tx.deudaCash.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          proveedor: { select: { vendorId: true, nombre: true } },
          cuentaPorPagar: true,
        },
      })
      if (!deudaActualizada) return null
      await AuditLogService.logStrict({
        accion: 'UPDATE',
        entidad: 'DEUDA_CASH',
        entidadId: id,
        usuarioId: user.userId,
        detalles: {
          cambios: {
            ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: deudaActualizada.fechaVencimiento } } : {}),
            ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(deudaActualizada.tasaInteres) } } : {}),
            ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: deudaActualizada.observaciones } } : {})
          }
        }
      }, tx)
      return deudaActualizada
    })
    if (!deuda) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

    return NextResponse.json({ deuda })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error actualizando deuda cash:', error)
    return NextResponse.json({ error: 'Error actualizando deuda cash' }, { status: 500 })
  }
})
