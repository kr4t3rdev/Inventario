import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken requerido'),
});

/**
 * @description Mobile refresh endpoint returning a fresh token pair.
 * @param {Request} request - Incoming request with refresh token.
 * @returns {Promise<Response>} Mobile refresh response.
 */
export async function POST(request: Request) {
  try {
    const body = refreshSchema.parse(await request.json());
    const tokens = await AuthService.refresh({
      refreshToken: body.refreshToken,
      client: {
        tenantId: request.headers.get('x-tenant-id'),
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for'),
      },
    });

    return successResponse({
      accessToken: {
        token: tokens.accessToken,
        expiresInSeconds: tokens.accessTokenMaxAge,
      },
      refreshToken: {
        token: tokens.refreshToken,
        expiresInSeconds: tokens.refreshTokenMaxAge,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    if (error instanceof ActionError) {
      const status = error.code === 'USER_INACTIVE' ? 403 : 401;
      return errorResponse(error.message, status, error.code);
    }
    console.error('Error en mobile refresh route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
