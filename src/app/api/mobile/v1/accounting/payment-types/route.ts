import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';

export const dynamic = 'force-dynamic';

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === 'true';
}

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const user = authResult.user as any;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return errorResponse('Contexto de tenant no disponible', 403, 'TENANT_REQUIRED');
    }

    const { searchParams } = new URL(request.url);
    const result = await AccountingConfigReadService.getPaymentTypes(tenantId, {
      includeInactive: parseBooleanParam(searchParams.get('includeInactive')),
      requiereCuenta: parseBooleanParam(searchParams.get('requiereCuenta')),
    });

    return successResponse({ items: result.data });
  } catch (error) {
    console.error('Error en mobile accounting payment types route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
