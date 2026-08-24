import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { requireTenant } from '@/lib/services/tenant-scope';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

/**
 * @description Expone los movimientos reconciliados como adaptador del servicio canónico.
 * @param {NextRequest} request - Solicitud con filtros y formato de exportación.
 * @returns {Promise<NextResponse>} Movimientos JSON o CSV.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) return authResult as Response;

    const user = authResult.user;
    const tenantId = requireTenant(user);
    const searchParams = request.nextUrl.searchParams;
    const formato = searchParams.get('formato') ?? searchParams.get('export');
    const report = await AccountingReportsService.getMovementsReport({
      tenantId,
      busqueda: searchParams.get('busqueda'),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaId: searchParams.get('cuentaId'),
      tipoMovimiento: searchParams.get('tipoMovimiento'),
      moneda: searchParams.get('moneda'),
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 10),
      formato,
      includeServicios: user.planFeatures?.servicios === true,
      includeTransfers: canAccessAccountingItem(user, 'Transferencias Bancarias'),
      includeAdjustments: canAccessAccountingItem(user, 'Ajustes Bancarios'),
      includeCapital: user.planFeatures?.['inyeccion-capital'] === true,
      includePrestamosCash: user.planFeatures?.['prestamos-cash'] === true,
      includeDeudasCash: user.planFeatures?.['deudas-cash'] === true,
    });

    if (formato === 'csv' && report.exportContent) {
      return new NextResponse(report.exportContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="movimientos-contables.csv"',
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error al generar reporte de movimientos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
