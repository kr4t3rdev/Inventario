import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function mapActionErrorStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'VALIDATION_ERROR':
      return 400;
    default:
      return 400;
  }
}

/**
 * @description Mobile sale cancel endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with sale id.
 * @returns {Promise<Response>} Sale cancellation response.
 */
export async function POST(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await VentaMutationService.cancel({
      input: { ventaId: id, motivo: body?.motivo },
      user: authResult.user,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
    }
    console.error('Error en mobile sales cancel route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
