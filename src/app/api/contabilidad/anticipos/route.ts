import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { createAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'

export { GET } from '@/app/api/anticipos/route'

const CreateAnticipoSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  contratoId: z.string().min(1),
  proveedorId: z.string().optional(),
  clienteId: z.string().optional(),
  monto: z.coerce.number().positive(),
  moneda: z.string().min(1),
  cuentaOrigenId: z.string().optional(),
  tipoPagoOrigenId: z.string().optional(),
  referenciaExterna: z.string().optional(),
  vigenciaHasta: z.string().optional(),
})

/**
 * @description Crea un anticipo con validación de período contable.
 * @param {NextRequest} request - Request HTTP.
 * @returns {Promise<NextResponse>} Anticipo creado.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)
    const body = await request.json()
    const payload = CreateAnticipoSchema.parse(body)

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

    const anticipo = await prisma.$transaction(async (tx) => {
      return createAnticipo(tx, {
        ...payload,
        tenantId,
        vigenciaHasta: payload.vigenciaHasta || undefined,
        usuarioId: user.userId,
      })
    })

    return NextResponse.json({ anticipo }, { status: 201 })
  } catch (error) {
    console.error('Error al crear anticipo:', error)

    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', issues: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al crear anticipo' }, { status: 500 })
  }
})
