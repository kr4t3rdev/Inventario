import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ActionError } from '@/lib/server-actions'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
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

    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.contabilidad.acceder', 'consultar préstamos cash')
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params

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
    if (error instanceof ActionError && ['FORBIDDEN', 'TENANT_REQUIRED'].includes(error.code)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    console.error('Error obteniendo préstamo cash:', error)
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

    requirePermission(user, 'financiero.contabilidad.acceder', 'editar préstamos cash')
    requireFeature(user, 'prestamos-cash', 'editar préstamos cash')
    const tenantId = requireTenant(user)
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

    const existing = await prisma.prestamoCash.findFirst({
      where: { id, tenantId, deletedAt: null }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    const prestamo = await prisma.prestamoCash.update({
      where: { id, tenantId },
      data: {
        ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}),
        ...(data.tasaInteres !== undefined ? { tasaInteres: data.tasaInteres } : {}),
        ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {})
      },
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

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        cambios: {
          ...(data.fechaVencimiento !== undefined ? { fechaVencimiento: { anterior: existing.fechaVencimiento, nuevo: prestamo.fechaVencimiento } } : {}),
          ...(data.tasaInteres !== undefined ? { tasaInteres: { anterior: Number(existing.tasaInteres), nuevo: Number(prestamo.tasaInteres) } } : {}),
          ...(data.observaciones !== undefined ? { observaciones: { anterior: existing.observaciones, nuevo: prestamo.observaciones } } : {})
        }
      }
    })

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
    if (error instanceof ActionError && ['FORBIDDEN', 'TENANT_REQUIRED', 'FEATURE_NOT_AVAILABLE'].includes(error.code)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    if (error instanceof ActionError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error actualizando préstamo cash:', error)
    return NextResponse.json({ error: 'Error actualizando préstamo cash' }, { status: 500 })
  }
})
