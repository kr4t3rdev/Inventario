import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { VentaReadService } from '@/features/ventas/services/venta-read-service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Mobile sale detail endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with sale id.
 * @returns {Promise<Response>} Sale detail response.
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const item = await VentaReadService.getById({ tenantId, ventaId: id });
    return successResponse(item);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile sale detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
