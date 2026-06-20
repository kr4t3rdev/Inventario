import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser) return authResultUser as Response;

    const { searchParams } = new URL(request.url);
    const result = await AccountingReportsService.getTransfersReport({
      tenantId: authResultUser.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      cuentaOrigenId: searchParams.get('cuentaOrigenId'),
      cuentaDestinoId: searchParams.get('cuentaDestinoId'),
      moneda: searchParams.get('moneda'),
      page: Number.parseInt(searchParams.get('page') || '1', 10),
      limit: Number.parseInt(searchParams.get('limit') || '50', 10),
      ...(searchParams.get('realizadoPor') ? { realizadoPor: searchParams.get('realizadoPor') } : {}),
      ...(searchParams.get('export') ? { export: searchParams.get('export') } : {}),
    });

    if (searchParams.get('export') === 'csv' && result.exportContent) {
      return new NextResponse(result.exportContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reporte-transferencias.csv"',
        },
      });
    }

    return NextResponse.json({
      transferencias: result.transferencias,
      estadisticas: result.estadisticas,
      paginacion: result.paginacion,
      filtros: result.filtros,
    });
  } catch (error) {
    console.error('Error al generar reporte de transferencias:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
