import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReconciliationService.getExpensesHistory({
      tenantId: authResult.user.tenantId ?? '',
      tipoGasto: searchParams.get('tipoGasto'),
      cuentaId: searchParams.get('cuentaId'),
      fechaDesde: searchParams.get('fechaDesde'),
      fechaHasta: searchParams.get('fechaHasta'),
      periodo: searchParams.get('periodo'),
      reconciliadoPor: searchParams.get('reconciliadoPor'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 50),
    });

    return successResponse({
      items: result.reconciliaciones,
      estadisticas: result.estadisticas,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error en mobile accounting reconciliation expenses history route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
