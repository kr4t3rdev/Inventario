import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  try {
    const user = authResult.user;
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('clienteId');

    if (!clienteId) {
      return errorResponse('clienteId es requerido', 400, 'VALIDATION_ERROR');
    }

    if (user.role !== 'admin' && user.planFeatures?.facturacion !== true) {
      return errorResponse(
        'Tu plan actual no incluye la funcionalidad de gestionar facturación. Actualiza tu plan para continuar.',
        403,
        'FEATURE_NOT_AVAILABLE',
      );
    }

    const result = await AccountingReportsService.getClientAccountAnalysisReport({
      tenantId: user.tenantId ?? '',
      clienteId,
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error en mobile client account analysis report route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
