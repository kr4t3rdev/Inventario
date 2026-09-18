import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const tipoParam = searchParams.get('tipo');
    const result = await AccountingReportsService.getAdvancesSummaryReport({
      tenantId: authResult.user.tenantId ?? '',
      tipo: tipoParam === 'PAGO' || tipoParam === 'COBRO' ? tipoParam : null,
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile advances summary report route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
