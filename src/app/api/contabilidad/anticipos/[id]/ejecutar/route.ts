import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'

const ExecuteAnticipoSchema = z.object({
  contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']),
  documentoDestinoId: z.string().min(1),
  montoObjetivo: z.coerce.number().positive(),
  monedaObjetivo: z.string().min(1),
  tasaAplicada: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1),
  observaciones: z.string().optional(),
})

/** @description Impide la ejecución manual fuera del writer del documento destino. */
export const POST = withAuthPost(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) => {
  try {
    requireTenant(user)
    requireFeature(user, 'anticipos', 'ejecutar anticipos')
    requirePermission(user, 'financiero.contabilidad.acceder', 'ejecutar anticipos')
    await params
    ExecuteAnticipoSchema.parse(await request.json())

    return NextResponse.json({
      error: 'El anticipo se aplica automáticamente al crear el documento que lo consume.',
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
    console.error('Error al validar ejecución de anticipo:', error)
    return NextResponse.json({ error: 'No se pudo validar la ejecución del anticipo' }, { status: 500 })
  }
})
