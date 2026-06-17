import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const result = await AccountingAccountsService.getReceivablesMetrics({
      tenantId: authResult.user.tenantId ?? '',
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile accounts receivable metrics route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
