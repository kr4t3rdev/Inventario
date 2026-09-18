import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener resumen de anticipos:', error);
    return NextResponse.json({ error: 'Error al obtener resumen de anticipos' }, { status: 500 });
  }
}
