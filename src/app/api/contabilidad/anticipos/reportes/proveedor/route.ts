import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingReportsService.getProviderAdvancesReport({
      tenantId: authResult.user.tenantId ?? '',
      proveedorId: searchParams.get('proveedorId'),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener reporte de anticipos por proveedor:', error);
    return NextResponse.json({ error: 'Error al obtener reporte de anticipos por proveedor' }, { status: 500 });
  }
}
