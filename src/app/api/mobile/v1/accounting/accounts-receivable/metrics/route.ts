import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

export const dynamic = 'force-dynamic';

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'FEATURE_NOT_AVAILABLE':
    case 'FORBIDDEN':
    case 'TENANT_REQUIRED':
      return 403;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const tenantId = authResult.user.tenantId;
    if (!tenantId) {
      return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
    }
    requireFeature(authResult.user, 'cuentas-cobrar', 'ver métricas de cuentas por cobrar');
    const result = await AccountingAccountsService.getReceivablesMetrics({
      tenantId,
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile accounts receivable metrics route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
