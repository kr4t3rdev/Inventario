import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  getFacturaForTenant,
  mapFacturaForMobile,
} from '@/features/facturas/services/factura-read-service';
import { authorizeInvoicingFeature } from '../authorize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Gets an existing invoice inside the authenticated tenant.
 * @param {Request} request - Bearer-authenticated mobile request.
 * @param {RouteContext} context - Dynamic route parameters.
 * @returns {Promise<Response>} Mobile invoice detail or 404.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  const featureError = authorizeInvoicingFeature(authResult.user);
  if (featureError) return featureError;

  try {
    const { id } = await context.params;
    const factura = await getFacturaForTenant(id, tenantId);
    if (!factura) return errorResponse('Factura no encontrada', 404, 'NOT_FOUND');
    return successResponse(mapFacturaForMobile(factura));
  } catch (error) {
    console.error('Error consultando factura móvil:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
