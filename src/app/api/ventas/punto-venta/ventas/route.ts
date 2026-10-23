import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuthPost } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { withVentaCreateIdempotencyKey } from '@/features/ventas/lib/venta-create-request';
import type { CreateVentaInput } from '@/features/ventas/schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

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
    case 'IDEMPOTENCY_KEY_REUSED':
    case 'IDEMPOTENCY_RECEIPT_INCOMPLETE':
      return 409;
    default:
      return 400;
  }
}

/**
 * @description Crea una venta POS mediante una ruta estable para flujos browser-safe.
 * @param {NextRequest} request - Request HTTP autenticado.
 * @param {unknown} _context - Contexto no usado.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Response>} Venta creada o error recuperable.
 */
export const POST = withAuthPost(
  async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
      const body = withVentaCreateIdempotencyKey(
        await request.json(),
        request.headers.get('idempotency-key'),
      );
      const result = await VentaMutationService.create({ input: body as CreateVentaInput, user });
      revalidatePath('/busy/sales');
      return successResponse(result);
    } catch (error) {
      if (error instanceof ActionError) {
        return errorResponse(error.message, mapActionErrorStatus(error.code), error.code);
      }

      console.error('Error en ruta estable de ventas POS:', error);
      return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
    }
  },
);
