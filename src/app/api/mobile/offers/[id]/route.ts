import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  getOfertaForTenant,
  mapOfertaForMobile,
} from '@/features/ofertas/services/oferta-read-service';
import { authorizeOffersFeature } from '../authorize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Gets an existing offer inside the authenticated tenant.
 * @param {Request} request - Bearer-authenticated mobile request.
 * @param {RouteContext} context - Dynamic route parameters.
 * @returns {Promise<Response>} Mobile offer detail or 404.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  const featureError = authorizeOffersFeature(authResult.user);
  if (featureError) return featureError;

  try {
    const { id } = await context.params;
    const oferta = await getOfertaForTenant(id, tenantId);
    if (!oferta) return errorResponse('Oferta no encontrada', 404, 'NOT_FOUND');
    return successResponse(mapOfertaForMobile(oferta));
  } catch (error) {
    console.error('Error consultando oferta móvil:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
