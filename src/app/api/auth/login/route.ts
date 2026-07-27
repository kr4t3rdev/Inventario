import { ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';

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
 * @description Route Handler para /api/auth/login.
 * Usa AuthService como adapter HTTP y mantiene compatibilidad con clients legacy.
 * @param {Request} request - Request entrante con credenciales.
 * @returns {Promise<Response>} Respuesta JSON de autenticación.
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

    const response = Response.json({
      user: result.user,
      redirectTo: result.redirectTo,
    });

    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.headers.append(
      'Set-Cookie',
      `auth_token=${result.tokens.accessToken}; Path=/; Max-Age=${result.tokens.accessTokenMaxAge}; HttpOnly; SameSite=Lax${secure}`,
    );
    response.headers.append(
      'Set-Cookie',
      `refreshToken=${result.tokens.refreshToken}; Path=/; Max-Age=${result.tokens.refreshTokenMaxAge}; HttpOnly; SameSite=Lax${secure}`,
    );

    return response;
  } catch (error) {
    if (error instanceof ActionError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: STATUS_MAP[error.code] ?? 401 },
      );
    }

    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return Response.json(
        { error: 'Datos inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    console.error('Error en login route:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
