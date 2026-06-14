import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const STATUS_MAP: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  USER_INACTIVE: 403,
  LICENSE_EXPIRED: 403,
  ACCOUNT_LOCKED: 403,
  NO_TENANT: 403,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
};

/**
 * @description Mobile login endpoint returning token JSON and no cookies.
 * @param {Request} request - Incoming request with credentials.
 * @returns {Promise<Response>} Mobile auth response.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await AuthService.login({
      input: body,
      client: {
        tenantId: request.headers.get('x-tenant-id'),
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for'),
      },
    });

    return successResponse({
      user: result.user,
      accessToken: {
        token: result.tokens.accessToken,
        expiresInSeconds: result.tokens.accessTokenMaxAge,
      },
      refreshToken: {
        token: result.tokens.refreshToken,
        expiresInSeconds: result.tokens.refreshTokenMaxAge,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    if (error instanceof ActionError) {
      return errorResponse(error.message, STATUS_MAP[error.code] ?? 401, error.code);
    }
    console.error('Error en mobile login route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
