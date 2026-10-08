import { z } from 'zod';

import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';

const schema = z.object({
  contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']),
  documentoDestinoId: z.string().min(1),
  montoObjetivo: z.coerce.number().positive(),
  monedaObjetivo: z.string().min(1),
  tasaAplicada: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1),
  observaciones: z.string().optional(),
});

/** @description Rechaza ejecución manual; la aplicación ocurre en el writer documental. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateUser(request as never);
  if ('status' in auth) return auth as Response;

  try {
    requireTenant(auth.user);
    requireFeature(auth.user, 'anticipos', 'ejecutar anticipos');
    requirePermission(auth.user, 'financiero.contabilidad.acceder', 'ejecutar anticipos');
    await params;
    schema.parse(await request.json());
    return errorResponse(
      'El anticipo se aplica automáticamente al crear el documento que lo consume.',
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
    console.error('Error al validar ejecución de anticipo mobile:', error);
    return errorResponse('No se pudo validar la ejecución del anticipo', 500, 'INTERNAL_ERROR');
  }
}
