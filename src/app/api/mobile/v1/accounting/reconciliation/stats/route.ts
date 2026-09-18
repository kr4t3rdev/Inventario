import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireTenant } from '@/lib/services/tenant-scope';
import {
  getReconciliationStats,
} from '@/features/contabilidad/services/reconciliation-stats-service';

export const dynamic = 'force-dynamic';

/**
 * @description Returns tenant-scoped reconciliation statistics for the mobile accounting API.
 * @param {Request} request - Authenticated API request.
 * @returns {Promise<Response>} Raw snapshot or the existing authentication/error response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const tenantId = requireTenant(authResult.user);
    const snapshot = await getReconciliationStats({ tenantId });

    return successResponse(snapshot);
  } catch (error) {
    console.error('Error en mobile accounting reconciliation stats route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
