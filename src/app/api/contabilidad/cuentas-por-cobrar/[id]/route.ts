import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'

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
): Promise<NextResponse> {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'ID de cuenta por cobrar no especificado' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as UpdateCuentaPorCobrarBody
    const data: Record<string, unknown> = {}

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

    const cuenta = await prisma.cuentaPorCobrar.update({
      where: { id },
      data
    })

    return NextResponse.json({ cuenta })
  } catch (error: any) {
    console.error('Error updating account receivable:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Error updating account receivable' }, { status: 500 })
  }
}
