import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';

export const dynamic = 'force-dynamic';

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'VALIDATION_ERROR':
    case 'STOCK_INSUFICIENTE':
    case 'STOCK_INCONSISTENTE':
    case 'FEATURE_NOT_AVAILABLE':
      return 400;
    default:
      return 400;
  }
}

/**
 * @description Mobile sale creation endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Sale creation response.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const body = await request.json();
    const result = await VentaMutationService.create({
      input: body,
      user: authResult.user,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile sales create route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
