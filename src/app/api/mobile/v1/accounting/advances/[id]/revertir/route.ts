import { z } from 'zod';

import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';

const schema = z.object({
  documentoDestinoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  observaciones: z.string().optional(),
});

/** @description Rechaza reversión manual; la corrección ocurre en el writer del documento. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateUser(request as never);
  if ('status' in auth) return auth as Response;

  try {
    requireTenant(auth.user);
    requireFeature(auth.user, 'anticipos', 'revertir anticipos');
    requirePermission(auth.user, 'financiero.contabilidad.acceder', 'revertir anticipos');
    await params;
    schema.parse(await request.json());
    return errorResponse(
      'La reversión del anticipo debe realizarse al revertir el documento que lo consumió.',
      409,
      'DOCUMENT_WORKFLOW_REQUIRED',
    );
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE' ||
        error.code === 'TENANT_REQUIRED' ? 403 : 400;
      return errorResponse(error.message, status, error.code);
    }
    if (error instanceof z.ZodError) {
      return errorResponse('Payload inválido', 400, 'VALIDATION_ERROR', error.flatten());
    }
    console.error('Error al validar reversión de anticipo mobile:', error);
    return errorResponse('No se pudo validar la reversión del anticipo', 500, 'INTERNAL_ERROR');
  }
}
