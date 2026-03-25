import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { isAnticipoWorkflowError, reverseAnticipo } from '@/lib/services/anticipos-workflow'
import { AuditLogService } from '@/lib/services/audit-log-service'

const reverseSchema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  observaciones: z.string().optional()
})

function anticiposEnabled(): boolean {
  return process.env.ENABLE_ANTICIPOS !== 'false'
}

export const POST = withAuthPost(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) => {
    try {
      if (!anticiposEnabled()) {
        return NextResponse.json({ error: 'Módulo de anticipos deshabilitado' }, { status: 404 })
      }

      const { id } = await context.params
      const payload = reverseSchema.parse(await request.json())

      const result = await prisma.$transaction(async (tx) => {
        return reverseAnticipo(tx, {
          anticipoId: id,
          documentoDestinoId: payload.documentoDestinoId,
          montoReverso: payload.montoReverso,
          observaciones: payload.observaciones,
          usuarioId: user.userId
        })
      })

      await AuditLogService.log({
        accion: 'UPDATE',
        entidad: 'ANTICIPO',
        entidadId: result.anticipoId,
        usuarioId: user.userId,
        detalles: {
          documentoDestinoId: payload.documentoDestinoId,
          montoReverso: payload.montoReverso,
          movimientoId: result.movimientoId,
          estado: result.estado
        }
      })

      return NextResponse.json({ result })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
      }
      if (isAnticipoWorkflowError(error)) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
      }
      console.error('Error revirtiendo anticipo:', error)
      return NextResponse.json({ error: 'Error revirtiendo anticipo' }, { status: 500 })
    }
  }
)
