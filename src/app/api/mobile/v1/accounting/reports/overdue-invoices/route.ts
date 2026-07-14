import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const user = authResult.user;

    try {
      requireFeature(user, 'facturas-vencidas', 'reporte de facturas vencidas');
    } catch {
      return errorResponse('Tu plan actual no incluye reporte de facturas vencidas.', 403, 'FORBIDDEN');
    }

    const result = await AccountingReportsService.getOverdueInvoicesReport({
      tenantId: user.tenantId ?? '',
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile overdue invoices report route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
