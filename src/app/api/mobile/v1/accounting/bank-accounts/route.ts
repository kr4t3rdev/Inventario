import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { errorResponse, successResponse } from '@/lib/api-response';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { requireFeature } from '@/lib/services/tenant-scope';

export const dynamic = 'force-dynamic';

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
    requireFeature(authResult.user, 'contabilidad', 'consultar cuentas bancarias');
    const result = await BankAccountReadService.list(tenantId);
    return successResponse({ items: result.cuentas });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, 403, error.code);
    }
    console.error('Error en mobile accounting bank accounts route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
