import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { VentaReadService } from '@/features/ventas/services/venta-read-service';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile sales list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Sales list response.
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
    const items = await VentaReadService.list(tenantId, {
      search: searchParams.get('search'),
      puntoDeVentaId: searchParams.get('puntoDeVentaId'),
      clienteId: searchParams.get('clienteId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
    });

    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile sales route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
