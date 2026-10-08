import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'

const ReverseAnticipoSchema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  observaciones: z.string().optional(),
})

/** @description Impide la reversión manual fuera del writer inverso del documento. */
export const POST = withAuthPost(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) => {
  try {
    requireTenant(user)
    requireFeature(user, 'anticipos', 'revertir anticipos')
    requirePermission(user, 'financiero.contabilidad.acceder', 'revertir anticipos')
    await params
    ReverseAnticipoSchema.parse(await request.json())

    return NextResponse.json({
      error: 'La reversión del anticipo debe realizarse al revertir el documento que lo consumió.',
      code: 'DOCUMENT_WORKFLOW_REQUIRED',
    }, { status: 409 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', issues: error.flatten() }, { status: 400 })
    }
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error al validar reversión de anticipo:', error)
    return NextResponse.json({ error: 'No se pudo validar la reversión del anticipo' }, { status: 500 })
  }
})
