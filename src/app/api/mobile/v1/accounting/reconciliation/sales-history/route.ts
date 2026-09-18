import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReconciliationService.getSalesHistory({
      tenantId: authResult.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaDesde') ?? searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaHasta') ?? searchParams.get('fechaFin'),
      cuentaId: searchParams.get('cuentaId'),
    });
    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile accounting sales reconciliation history route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
