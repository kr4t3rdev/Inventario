import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReportsService.getTransfersReport({
      tenantId: authResult.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaOrigenId: searchParams.get('cuentaOrigenId'),
      cuentaDestinoId: searchParams.get('cuentaDestinoId'),
      moneda: searchParams.get('moneda'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 50),
      ...(searchParams.get('realizadoPor') ? { realizadoPor: searchParams.get('realizadoPor') } : {}),
      ...(searchParams.get('export') ? { export: searchParams.get('export') } : {}),
    });

    return successResponse({
      items: result.transferencias,
      estadisticas: result.estadisticas,
      pagination: result.paginacion,
      filtros: result.filtros,
      exportContent: result.exportContent,
    });
  } catch (error) {
    console.error('Error en mobile accounting reports transfers route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
