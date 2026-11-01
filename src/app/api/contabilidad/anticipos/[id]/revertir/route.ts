import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { reverseAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'

const ReverseAnticipoSchema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  idempotencyKey: z.string().trim().min(1).optional(),
  observaciones: z.string().optional(),
})

/**
 * @description Revierte una ejecución de anticipo
 * @param {NextRequest} request - Request HTTP
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant resuelto
 * @returns {Promise<NextResponse>} Resultado de la reversión
 */
export const POST = withAuthPost(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    user: AuthenticatedUser
  ) => {
    try {
      const { id: anticipoId } = await params
      if (!user.tenantId) {
        return NextResponse.json({ error: 'Tenant requerido', code: 'TENANT_REQUIRED' }, { status: 403 })
      }
      const tenantId = user.tenantId
      const body = await request.json()
      const payload = ReverseAnticipoSchema.parse(body)

      // Obtener anticipo para validación de tenant y período
      const anticipo = await prisma.anticipo.findFirst({
        where: { anticipoId, tenantId },
        select: { tenantId: true },
      })

      if (!anticipo) {
        return NextResponse.json(
          { error: 'Anticipo no encontrado', code: 'ANTICIPO_NO_ENCONTRADO' },
          { status: 404 }
        )
      }

      // Validar período contable antes de revertir
      const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
      const validacionPeriodo = await validarEscrituraPeriodo({
        fecha: fechaOperacion,
        tenantId,
        tipoOperacion: 'revertir_anticipo',
        actor: user.userId,
      })
      if (!validacionPeriodo.permitido) {
        return NextResponse.json(
          { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
          { status: 400 }
        )
      }

      const resultado = await prisma.$transaction(async (tx) => {
        return reverseAnticipo(tx, {
          anticipoId,
          tenantId,
          documentoDestinoId: payload.documentoDestinoId,
          montoReverso: payload.montoReverso,
          idempotencyKey: payload.idempotencyKey,
          observaciones: payload.observaciones,
          usuarioId: user.userId,
        })
      })

      return NextResponse.json({ result: resultado }, { status: 200 })
    } catch (error) {
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
