import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

interface UpdateCuentaPorCobrarBody {
  montoPagado?: number
  estado?: 'PENDIENTE' | 'PARCIAL' | 'PAGADA'
  idTransferencia?: string | null
  fechaVencimiento?: string | null
}

/**
 * @description Actualiza una cuenta por cobrar por su ID.
 * @param {NextRequest} request - Request HTTP con datos parciales de actualización.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta dinámica.
 * @returns {Promise<NextResponse>} Respuesta JSON con la cuenta actualizada.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'ID de cuenta por cobrar no especificado' },
        { status: 400 }
      )
    }

    // Validar que el período permite operaciones
    await assertOperationAllowed(new Date(), 'CUENTA_POR_COBRAR')

    const body = (await request.json()) as UpdateCuentaPorCobrarBody
    const data: Record<string, unknown> = {}

    await assertOperationAllowed(new Date(), 'CUENTA_POR_COBRAR')

    if (typeof body.montoPagado === 'number' && Number.isFinite(body.montoPagado)) {
      data.montoPagado = body.montoPagado
    }
    if (typeof body.estado === 'string') {
      data.estado = body.estado
    }
    if ('idTransferencia' in body) {
      data.idTransferencia = body.idTransferencia ?? null
    }
    if ('fechaVencimiento' in body) {
      data.fechaVencimiento = body.fechaVencimiento
        ? new Date(body.fechaVencimiento)
        : null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      )
    }

    const anterior = await prisma.cuentaPorCobrar.findUnique({ where: { id } })

    const cuenta = await prisma.cuentaPorCobrar.update({
      where: { id },
      data
    })

    // Registrar evento contable si cambia el estado o el monto pagado
    if ((data.estado && anterior?.estado !== cuenta.estado) || 
        (data.montoPagado && anterior?.montoPagado !== cuenta.montoPagado)) {
      const montoEventoContable = typeof data.montoPagado === 'number' 
        ? data.montoPagado 
        : Number(cuenta.montoPagado || 0)
      
      if (montoEventoContable > 0) {
        await registrarEventoContable({
          origenTipo: 'CUENTA_POR_COBRAR',
          origenId: id,
          monto: montoEventoContable,
          fechaOperacion: new Date(),
          descripcion: `Actualización de cuenta por cobrar - estado: ${cuenta.estado}`,
          usuarioId: user.userId
        })
      }
    }

    const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}
    for (const key of Object.keys(data)) {
      const prev = anterior ? (anterior as Record<string, unknown>)[key] : undefined
      const curr = (cuenta as Record<string, unknown>)[key]
      if (prev !== curr) {
        cambios[key] = { anterior: prev, nuevo: curr }
      }
    }

    await registrarEventoContable({
      origenTipo: 'CUENTA_POR_COBRAR',
      origenId: id,
      monto: data.montoPagado as number || 0,
      fechaOperacion: new Date(),
      descripcion: `Actualización de cuenta por cobrar ${id} - ${body.estado || 'actualización'}`,
      usuarioId: user.userId,
    })

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'CUENTA_POR_COBRAR',
      entidadId: id,
      usuarioId: user.userId,
      detalles: { cambios }
    })

    return NextResponse.json({ cuenta })
  } catch (error: any) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Error updating account receivable:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Error updating account receivable' }, { status: 500 })
  }
}
