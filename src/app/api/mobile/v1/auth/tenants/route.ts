import { z } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const switchTenantSchema = z.object({
  tenantId: z.string().min(1, 'tenantId requerido'),
});

/**
 * @description Returns active tenants for the authenticated mobile user.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Tenants list.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const items = await AuthService.listTenants(authResult.user);
    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile tenants GET route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Switches active tenant for the authenticated mobile user and returns a fresh token context.
 * @param {Request} request - Incoming authenticated request with desired tenantId.
 * @returns {Promise<Response>} Tenant switch result.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const body = switchTenantSchema.parse(await request.json());
    const result = await AuthService.switchTenant({
      tenantId: body.tenantId,
      user: authResult.user,
      client: {
        tenantId: request.headers.get('x-tenant-id'),
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for'),
      },
    });

    return successResponse({
      tenantId: result.tenantId,
      tenantRole: result.tenantRole,
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
      return errorResponse(error.message, error.code === 'FORBIDDEN' ? 403 : 400, error.code);
    }
    console.error('Error en mobile tenants POST route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
