import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

export const dynamic = 'force-dynamic';

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'FEATURE_NOT_AVAILABLE':
    case 'FORBIDDEN':
    case 'TENANT_REQUIRED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}

/**
 * @description Convierte un query param a entero positivo con fallback.
 * @param {string | null} value - Valor a convertir.
 * @param {number} fallback - Valor por defecto.
 * @returns {number} Entero positivo válido.
 */
function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    requireFeature(authResult.user, 'contabilidad', 'consultar las cuentas por pagar existentes');
    requirePermission(authResult.user, 'financiero.contabilidad.acceder', 'consultar las cuentas por pagar');
    const { searchParams } = new URL(request.url);
    const result = await AccountingAccountsService.listPayables({
      tenantId: authResult.user.tenantId ?? '',
      search: searchParams.get('search'),
      estado: (searchParams.get('estado') as 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null) ?? null,
      tipo: (searchParams.get('tipo') as 'compra' | 'servicio' | null) ?? null,
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 10),
    });

    return successResponse({
      items: result.cuentas,
      pagination: result.pagination,
      metricas: result.metricas,
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile accounts payable route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
