import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

export const dynamic = 'force-dynamic';

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
    const { searchParams } = new URL(request.url);
    const result = await AccountingAccountsService.listReceivables({
      tenantId: authResult.user.tenantId ?? '',
      search: searchParams.get('search'),
      estado: (searchParams.get('estado') as 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null) ?? null,
      clienteId: searchParams.get('clienteId'),
      page: parsePositiveInt(searchParams.get('page'), 1),
      limit: parsePositiveInt(searchParams.get('limit'), 20),
    });

    return successResponse({ items: result.cuentas, pagination: result.pagination });
  } catch (error) {
    console.error('Error en mobile accounts receivable route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
