import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { AccountingAuditLogsService } from '@/features/contabilidad/services/accounting-audit-logs-service';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'FORBIDDEN':
      return 403;
    default:
      return 400;
  }
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingAuditLogsService.getLogs({
      user: authResult.user,
      entidad: searchParams.get('entidad'),
      limit: parsePositiveInt(searchParams.get('limit'), 50),
      offset: parsePositiveInt(searchParams.get('offset'), 0),
    });

    return successResponse({ items: result.logs, pagination: result.pagination });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }

    console.error('Error en mobile accounting logs route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
