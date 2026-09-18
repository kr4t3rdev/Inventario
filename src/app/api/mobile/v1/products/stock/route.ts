import { z } from 'zod';

import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ProductoService } from '@/features/productos/services/producto-service';

export const dynamic = 'force-dynamic';

const stockQuerySchema = z.object({
  ubicacionId: z.string().min(1, 'ubicacionId requerido'),
  tipoUbicacion: z.enum(['almacen', 'punto_venta']),
  includeZero: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? true : value === 'true')),
});

/**
 * @description Mobile stock-by-location endpoint mirroring the legacy stock action.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Stock response for one location.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = stockQuerySchema.parse({
      ubicacionId: searchParams.get('ubicacionId'),
      tipoUbicacion: searchParams.get('tipoUbicacion'),
      includeZero: searchParams.get('includeZero') ?? undefined,
    });

    const items = await ProductoService.listByLocation({
      tenantId,
      ubicacionId: parsed.ubicacionId,
      tipoUbicacion: parsed.tipoUbicacion,
      includeZero: parsed.includeZero,
    });

    return successResponse({ items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    console.error('Error en mobile products stock route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
