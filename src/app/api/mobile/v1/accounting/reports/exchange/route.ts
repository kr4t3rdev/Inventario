import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const serviceParams = {
      tenantId: authResult.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      monedaOrigen: searchParams.get('monedaOrigen'),
      monedaDestino: searchParams.get('monedaDestino'),
      ...(searchParams.get('export') ? { export: searchParams.get('export') } : {}),
    };
    const result = await AccountingReportsService.getExchangeReport(serviceParams);

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile accounting reports exchange route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
