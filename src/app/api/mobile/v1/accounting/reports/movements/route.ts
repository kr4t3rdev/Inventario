import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { requireTenant } from '@/lib/services/tenant-scope';

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
    const serviceParams = {
       tenantId: requireTenant(authResult.user),
      busqueda: searchParams.get('busqueda'),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaId: searchParams.get('cuentaId'),
      tipoMovimiento: searchParams.get('tipoMovimiento'),
      moneda: searchParams.get('moneda'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 10),
       ...(searchParams.get('formato') ? { formato: searchParams.get('formato') } : {}),
       includeServicios: authResult.user.planFeatures?.servicios === true,
       includeTransfers: canAccessAccountingItem(authResult.user, 'Transferencias Bancarias'),
       includeAdjustments: canAccessAccountingItem(authResult.user, 'Ajustes Bancarios'),
       includeCapital: authResult.user.planFeatures?.['inyeccion-capital'] === true,
       includePrestamosCash: authResult.user.planFeatures?.['prestamos-cash'] === true,
       includeDeudasCash: authResult.user.planFeatures?.['deudas-cash'] === true,
    };
    const result = await AccountingReportsService.getMovementsReport(serviceParams);

    return successResponse({
      items: result.data,
      totales: result.totales,
      pagination: result.pagination,
      filtros: result.filtros,
      exportContent: result.exportContent,
    });
  } catch (error) {
    console.error('Error en mobile accounting reports movements route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
