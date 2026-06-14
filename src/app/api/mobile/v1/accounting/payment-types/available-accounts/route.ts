import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const result = await AccountingConfigReadService.getAvailableAccounts({
      moneda: searchParams.get('moneda'),
      tipoCuenta: searchParams.get('tipoCuenta'),
    });

    return successResponse({
      items: result.cuentas,
      estadisticas: result.estadisticas,
    });
  } catch (error) {
    console.error('Error en mobile accounting available accounts route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
