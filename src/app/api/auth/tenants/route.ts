import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';

export const dynamic = 'force-dynamic';

const switchTenantSchema = z.object({
  tenantId: z.string().min(1, 'tenantId requerido'),
});

/**
 * @description Devuelve los tenants activos del usuario autenticado para web.
 * @param {Request} request - Request autenticado.
 * @returns {Promise<Response>} Lista de tenants del usuario.
 */
export async function GET(request: Request): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const items = await AuthService.listTenants(authResult.user);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error en auth tenants GET route:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * @description Cambia el tenant activo para web y refresca las cookies httpOnly.
 * @param {Request} request - Request autenticado con el tenant objetivo.
 * @returns {Promise<Response>} Resultado del cambio de tenant.
 */
export async function POST(request: Request): Promise<Response> {
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

    const response = NextResponse.json({
      tenantId: result.tenantId,
      tenantRole: result.tenantRole,
    });

    response.cookies.set('auth_token', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.tokens.accessTokenMaxAge,
    });
    response.cookies.set('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.tokens.refreshTokenMaxAge,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    console.error('Error en auth tenants POST route:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
