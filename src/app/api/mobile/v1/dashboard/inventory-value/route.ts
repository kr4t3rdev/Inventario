import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getDashboardStatsData } from '@/features/dashboard/services/dashboard-stats-service';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile dashboard inventory value endpoint (Bearer <redacted>
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Dashboard section response.
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
    const data = await getDashboardStatsData({
      tenantId,
      ubicacionId: searchParams.get('ubicacionId'),
      tipoUbicacion: searchParams.get('tipoUbicacion'),
    });
    return successResponse({ value: data.valorTotalInventario });
  } catch (error) {
    console.error('Error en mobile dashboard inventory-value route:', error);
    return errorResponse('Error al obtener valor de inventario', 500, 'INTERNAL_ERROR');
  }
}
