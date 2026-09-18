import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  listOfertasForTenant,
  mapOfertaForMobile,
} from '@/features/ofertas/services/oferta-read-service';
import { authorizeOffersFeature } from './authorize';

export const dynamic = 'force-dynamic';

/**
 * @description Lists existing offers for the authenticated tenant.
 * @param {Request} request - Bearer-authenticated mobile request.
 * @returns {Promise<Response>} Mobile offer collection.
 */
export async function GET(request: Request): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  const featureError = authorizeOffersFeature(authResult.user);
  if (featureError) return featureError;

  try {
    const ofertas = await listOfertasForTenant(tenantId);
    return successResponse({ items: ofertas.map(mapOfertaForMobile) });
  } catch (error) {
    console.error('Error listando ofertas móviles:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
