import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

export { GET } from '@/app/api/anticipos/[id]/route'

const UpdateAnticipoSchema = z.object({
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
  saldoDisponible: z.number().nonnegative().optional(),
  vigenciaHasta: z.string().nullable().optional(),
  referenciaExterna: z.string().nullable().optional(),
})

/**
 * @description Actualiza un anticipo con validación de período contable.
 * @param {NextRequest} request - Request HTTP.
 * @returns {Promise<NextResponse>} Anticipo actualizado.
 */
export const PUT = withAuthPost(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
) => {
  try {
    const tenantId = requireTenant(user)
    const { id } = await params
    const body = await request.json()
    const payload = UpdateAnticipoSchema.parse(body)

    // Validar período contable
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'anticipo',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const existing = await prisma.anticipo.findUnique({
      where: { anticipoId: id },
      select: { anticipoId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Anticipo no encontrado' }, { status: 404 })
    }

    const anticipo = await prisma.anticipo.update({
      where: { anticipoId: id },
      data: {
        ...(payload.estado && { estado: payload.estado }),
        ...(payload.saldoDisponible !== undefined && { saldoDisponible: payload.saldoDisponible }),
        ...(payload.referenciaExterna !== undefined && { referenciaExterna: payload.referenciaExterna }),
        ...(payload.vigenciaHasta !== undefined && {
          vigenciaHasta: payload.vigenciaHasta ? new Date(payload.vigenciaHasta) : null,
        }),
      },
    })

    return NextResponse.json({ anticipo })
  } catch (error) {
    console.error('Error al actualizar anticipo:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', issues: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al actualizar anticipo' }, { status: 500 })
  }
})

/**
 * @description Elimina un anticipo con validación de período contable.
 * @param {NextRequest} _request - Request HTTP.
 * @returns {Promise<NextResponse>} Mensaje de eliminación.
 */
export const DELETE = withAuthPost(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
) => {
  try {
    const tenantId = requireTenant(user)
    const { id } = await params

    // Validar período contable
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: new Date(),
      tenantId,
      tipoOperacion: 'anticipo',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const existing = await prisma.anticipo.findUnique({
      where: { anticipoId: id },
      select: { anticipoId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Anticipo no encontrado' }, { status: 404 })
    }

    await prisma.anticipo.delete({ where: { anticipoId: id } })

    return NextResponse.json({ message: 'Anticipo eliminado' })
  } catch (error) {
    console.error('Error al eliminar anticipo:', error)
    return NextResponse.json({ error: 'Error al eliminar anticipo' }, { status: 500 })
  }
})
