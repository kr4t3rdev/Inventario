import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { requireTenant } from '@/lib/services/tenant-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const serviceParams = {
      tenantId: requireTenant(authResult.user),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaId: searchParams.get('cuentaId'),
      moneda: searchParams.get('moneda'),
      ...(searchParams.get('export') ? { export: searchParams.get('export') } : {}),
      includeServicios: authResult.user.planFeatures?.servicios === true,
      includeTransfers: canAccessAccountingItem(authResult.user, 'Transferencias Bancarias'),
      includeAdjustments: canAccessAccountingItem(authResult.user, 'Ajustes Bancarios'),
      includeCapital: authResult.user.planFeatures?.['inyeccion-capital'] === true,
      includePrestamosCash: authResult.user.planFeatures?.['prestamos-cash'] === true,
      includeDeudasCash: authResult.user.planFeatures?.['deudas-cash'] === true,
    };
    const result = await AccountingReportsService.getSummaryReport(serviceParams);

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile accounting reports summary route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
