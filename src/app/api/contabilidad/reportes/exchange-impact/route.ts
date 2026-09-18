import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser) return authResultUser as Response;

    if (
      authResultUser.user.role !== 'admin' &&
      (
        authResultUser.user.planFeatures?.['reportes-financieros'] !== true ||
        authResultUser.user.planFeatures?.['multi-moneda'] !== true
      )
    ) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const result = await AccountingReportsService.getExchangeImpactReport({
      tenantId: authResultUser.user.tenantId ?? '',
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      monedaBase: searchParams.get('monedaBase'),
      tipoAnalisis: searchParams.get('tipoAnalisis'),
    });

    return NextResponse.json({
      resumen: result.resumen,
      porMoneda: result.porMoneda,
      porCuenta: result.porCuenta,
      recomendaciones: result.recomendaciones,
      filtros: result.filtros,
    });
  } catch (error) {
    console.error('Error al generar análisis de impacto del exchange:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
