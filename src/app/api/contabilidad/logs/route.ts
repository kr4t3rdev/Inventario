import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AccountingAuditLogsService } from '@/features/contabilidad/services/accounting-audit-logs-service';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    if (
      authResult.user.role !== 'admin' &&
      authResult.user.planFeatures?.contabilidad !== true
    ) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const result = await AccountingAuditLogsService.getLogs({
      user: authResult.user,
      entidad: sp.get('entidad'),
      accion: sp.get('accion'),
      desde: sp.get('desde'),
      hasta: sp.get('hasta'),
      limit: parsePositiveInt(sp.get('limit'), 50),
      offset: parsePositiveInt(sp.get('offset'), 0),
    });

    return NextResponse.json({ logs: result.logs, total: result.total });
  } catch (error) {
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('Error obteniendo logs de contabilidad:', error);
    return NextResponse.json({ error: 'Error obteniendo logs de contabilidad' }, { status: 500 });
  }
}
