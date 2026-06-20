import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser) return authResultUser as Response;

    const { searchParams } = new URL(request.url);
    const result = await AccountingReportsService.getExchangeReport({
      tenantId: authResultUser.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      monedaOrigen: searchParams.get('monedaOrigen'),
      monedaDestino: searchParams.get('monedaDestino'),
      ...(searchParams.get('export') ? { export: searchParams.get('export') } : {}),
    });

    if (searchParams.get('export') === 'csv' && result.exportContent) {
      return new NextResponse(result.exportContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reporte-exchange.csv"',
        },
      });
    }

    return NextResponse.json({
      historialTasas: result.historialTasas,
      transaccionesConversion: result.transaccionesConversion,
      conversiones: result.conversiones,
      estadisticasConversion: result.estadisticasConversion,
      filtros: result.filtros,
    });
  } catch (error) {
    console.error('Error al generar reporte de exchange:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
