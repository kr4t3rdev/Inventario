import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'

const updateSchema = z.object({
  fechaVencimiento: z.string().optional(),
  tasaInteres: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
  montoCapital: z.never().optional(),
  moneda: z.never().optional()
}).strict()

/**
 * @description Verifica si el módulo de préstamos cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'
}

/**
 * @description Obtiene un préstamo cash por ID con cliente y cuenta por cobrar
 * @param {NextRequest} request - Request
 * @returns {NextResponse} Préstamo encontrado o 404
 */
export const GET = withAuthGet(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const tenantId = requireTenant(user)
    requireFeature(user, 'prestamos-cash', 'consultar préstamos cash')
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar préstamos cash')

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        cliente: {
          select: {
            clienteId: true,
            nombre: true
          }
        },
        cuentaPorCobrar: true
      }
    })

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    const saldoPendiente = calcularSaldoPendientePrestamo(
      Number(prestamo.cuentaPorCobrar.montoDeuda),
      Number(prestamo.cuentaPorCobrar.montoPagado)
    )

    const prestamoNormalizado = {
      ...prestamo,
      estado: normalizarEstadoPrestamoCash(prestamo.estado, {
        montoDeuda: Number(prestamo.cuentaPorCobrar.montoDeuda),
        montoPagado: Number(prestamo.cuentaPorCobrar.montoPagado),
        estado: prestamo.cuentaPorCobrar.estado,
      }),
      saldoPendiente,
    }

    return NextResponse.json({ prestamo: prestamoNormalizado })
  } catch (error) {
    console.error('Error obteniendo préstamo cash:', error)
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    return NextResponse.json({ error: 'Error obteniendo préstamo cash' }, { status: 500 })
  }
})

/**
 * @description Actualiza campos permitidos de un préstamo cash (fechaVencimiento, tasaInteres, observaciones)
 * @param {NextRequest} request - Request con body de campos a actualizar
 * @returns {NextResponse} Préstamo actualizado
 */
export const PUT = withAuthPost(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user)
    requireFeature(user, 'prestamos-cash', 'actualizar préstamos cash')
    requirePermission(user, 'financiero.contabilidad.acceder', 'actualizar préstamos cash')
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

    const body = await request.json()

    // Validar período contable
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'prestamo_cash',
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
        { error: 'No se permite modificar montoCapital ni moneda de un préstamo existente' },
        { status: 400 }
      )
    }

    const data = updateSchema.parse(body)

    const prestamo = await prisma.$transaction(async (tx) => {
      const existing = await tx.prestamoCash.findFirst({ where: { id, tenantId, deletedAt: null } })
      if (!existing) return null

      const updated = await tx.prestamoCash.updateMany({
        where: { id, tenantId, deletedAt: null },
        data: {
          ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}),
          ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}),
          ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
        }
      })
      if (updated.count !== 1) return null

      const prestamoActualizado = await tx.prestamoCash.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          cliente: { select: { clienteId: true, nombre: true } },
          cuentaPorCobrar: true,
        },
      })
      if (!prestamoActualizado) return null
      await AuditLogService.logStrict({
        accion: 'UPDATE',
        entidad: 'PRESTAMO_CASH',
        entidadId: id,
        usuarioId: user.userId,
        detalles: {
          cambios: {
            ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: prestamoActualizado.fechaVencimiento } } : {}),
            ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(prestamoActualizado.tasaInteres) } } : {}),
            ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: prestamoActualizado.observaciones } } : {})
          }
        }
      }, tx)
      return prestamoActualizado
    })
    if (!prestamo) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    return NextResponse.json({
      prestamo: {
        ...prestamo,
        estado: normalizarEstadoPrestamoCash(prestamo.estado, {
          montoDeuda: Number(prestamo.cuentaPorCobrar.montoDeuda),
          montoPagado: Number(prestamo.cuentaPorCobrar.montoPagado),
          estado: prestamo.cuentaPorCobrar.estado,
        }),
        saldoPendiente: calcularSaldoPendientePrestamo(
          Number(prestamo.cuentaPorCobrar.montoDeuda),
          Number(prestamo.cuentaPorCobrar.montoPagado)
        ),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error actualizando préstamo cash:', error)
    return NextResponse.json({ error: 'Error actualizando préstamo cash' }, { status: 500 })
  }
})
