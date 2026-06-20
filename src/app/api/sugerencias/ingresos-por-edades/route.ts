import { type NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser) return authResultUser as Response;
    const user = authResultUser.user;

    if (user.role !== 'admin' && user.planFeatures?.['facturas-vencidas'] !== true) {
      return NextResponse.json(
        { error: 'Tu plan actual no incluye reporte de facturas vencidas.' },
        { status: 403 },
      );
    }

    const result = await AccountingReportsService.getOverdueInvoicesReport({
      tenantId: user.tenantId ?? '',
    });

    console.log(`[IngresosEdades] Generated ${result.reporte.length} clients and ${result.facturas.length} invoices`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching aging report:', error);
    return NextResponse.json({ error: 'Error fetching aging report' }, { status: 500 });
  }
}
