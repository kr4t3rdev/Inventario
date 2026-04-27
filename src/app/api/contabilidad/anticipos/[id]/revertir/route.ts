import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { reverseAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const ReverseAnticipoSchema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  observaciones: z.string().optional(),
})

/**
 * @description Revierte una ejecución de anticipo
 * @param {NextRequest} request - Request HTTP
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta
 * @param {{ userId: string }} user - Usuario autenticado
 * @returns {Promise<NextResponse>} Resultado de la reversión
 */
export const POST = withAuthPost(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    user: { userId: string }
  ) => {
    try {
      const { id: anticipoId } = await params
      const body = await request.json()
      const payload = ReverseAnticipoSchema.parse(body)

      await assertOperationAllowed(new Date(), 'REVERSION_ANTICIPO')

      const resultado = await prisma.$transaction(async (tx) => {
        return reverseAnticipo(tx, {
          anticipoId,
          documentoDestinoId: payload.documentoDestinoId,
          montoReverso: payload.montoReverso,
          observaciones: payload.observaciones,
          usuarioId: user.userId,
        })
      })

      await registrarEventoContable({
        origenTipo: 'REVERSION_ANTICIPO',
        origenId: anticipoId,
        monto: payload.montoReverso,
        fechaOperacion: new Date(),
        descripcion: payload.observaciones || `Reversión de anticipo ${anticipoId}`,
        usuarioId: user.userId,
      })

      // Registrar evento contable
      await registrarEventoContable({
        origenTipo: 'REVERSION_ANTICIPO',
        origenId: anticipoId,
        monto: payload.montoReverso,
        fechaOperacion: new Date(),
        descripcion: `Reversión de anticipo ${anticipoId}`,
        usuarioId: user.userId
      })

      return NextResponse.json({ result: resultado }, { status: 200 })
    } catch (error) {
      if (isPeriodoOperacionError(error)) {
        return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
      }

      console.error('Error al revertir anticipo:', error)

      if (isAnticipoWorkflowError(error)) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      }

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Payload inválido', issues: error.flatten() },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Error al revertir anticipo' },
        { status: 500 }
      )
    }
  }
)
