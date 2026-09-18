import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';

export const dynamic = 'force-dynamic';

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
    case 'TENANT_REQUIRED':
      return 403;
    case 'DISABLED':
      return 404;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const result = await AccountingCashOperationsService.getCashLoanStats({
      tenantId: authResult.user.tenantId ?? '',
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile cash loans stats route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
