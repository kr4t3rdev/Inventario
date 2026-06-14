/**
 * @description Server Actions de autenticación.
 *
 * Las Server Actions son adaptadores web: delegan la lógica de negocio en
 * AuthService y mantienen aquí únicamente responsabilidades de cookies/cache.
 *
 * @module features/auth/actions
 */
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { AuthService } from '@/features/auth/services/auth-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

/**
 * @description Escribe cookies httpOnly de autenticación para el cliente web.
 * @param {string} accessToken - JWT de acceso.
 * @param {string} refreshToken - JWT de refresh.
 * @param {number} accessTokenMaxAge - Duración del access token en segundos.
 * @param {number} refreshTokenMaxAge - Duración del refresh token en segundos.
 * @returns {Promise<void>} No retorna valor.
 */
async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  accessTokenMaxAge: number,
  refreshTokenMaxAge: number,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: accessTokenMaxAge,
  });
  cookieStore.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: refreshTokenMaxAge,
  });
}

/**
 * @description Borra cookies httpOnly de autenticación del cliente web.
 * @returns {Promise<void>} No retorna valor.
 */
async function deleteAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  cookieStore.delete('refreshToken');
}

/**
 * @description Inicia sesión de usuario para web, setea cookies y no devuelve JWT en body.
 * @param {z.infer<typeof loginSchema>} input - Credenciales de acceso.
 * @returns {Promise<{ success: true; data: { user: Record<string, unknown> } } | { success: false; error: { message: string; code: string } }>} Resultado de login.
 */
export async function loginAction(
  input: z.infer<typeof loginSchema>,
): Promise<
  | { success: true; data: { user: Record<string, unknown> } }
  | { success: false; error: { message: string; code: string } }
> {
  try {
    const result = await AuthService.login({ input });
    await setAuthCookies(
      result.tokens.accessToken,
      result.tokens.refreshToken,
      result.tokens.accessTokenMaxAge,
      result.tokens.refreshTokenMaxAge,
    );

    return { success: true, data: { user: result.user } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: { message: 'Datos inválidos', code: 'VALIDATION_ERROR' } };
    }

    if (error instanceof ActionError) {
      return { success: false, error: { message: error.message, code: error.code } };
    }

    console.error('[loginAction] Error:', error);
    return { success: false, error: { message: 'Error interno del servidor', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * @description Cierra sesión del usuario actual.
 */
export const logoutAction = withAction(
  async (_void: void, user: AuthenticatedUser) => {
    await AuthService.logout(user);
    await deleteAuthCookies();
    revalidatePath('/login');
    return { success: true };
  },
);

/**
 * @description Devuelve el usuario autenticado actual.
 */
export const meAction = withAction(
  async (_void: void, user: AuthenticatedUser) => AuthService.me(user),
);

/**
 * @description Refresca la sesión web usando refreshToken de cookie.
 * @param {void} _void - Sin input.
 * @returns {Promise<{ success: true; token: string; refreshToken: string }>} Nuevos tokens.
 */
export async function refreshSessionAction(_void: void): Promise<{
  success: true;
  token: string;
  refreshToken: string;
}> {
  const cookieStore = await cookies();
  const refreshTokenCookie = cookieStore.get('refreshToken');

  if (!refreshTokenCookie?.value) {
    await deleteAuthCookies();
    throw new ActionError('Sesión expirada', 'SESSION_EXPIRED');
  }

  try {
    const tokens = await AuthService.refresh({ refreshToken: refreshTokenCookie.value });
    await setAuthCookies(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessTokenMaxAge,
      tokens.refreshTokenMaxAge,
    );

    return { success: true, token: tokens.accessToken, refreshToken: tokens.refreshToken };
  } catch (error) {
    await deleteAuthCookies();
    throw error;
  }
}

/**
 * @description Devuelve los tenants a los que el usuario actual tiene acceso.
 */
export const getMyTenantsAction = withAction(
  async (_void: void, user: AuthenticatedUser) => AuthService.listTenants(user),
);

/**
 * @description Cambia el tenant activo del usuario y refresca cookies web.
 */
export const switchActiveTenantAction = withAction(
  async (tenantId: string, user: AuthenticatedUser) => {
    const result = await AuthService.switchTenant({ tenantId, user });
    await setAuthCookies(
      result.tokens.accessToken,
      result.tokens.refreshToken,
      result.tokens.accessTokenMaxAge,
      result.tokens.refreshTokenMaxAge,
    );

    revalidatePath('/', 'layout');
    return { tenantId: result.tenantId, tenantRole: result.tenantRole };
  },
);

/**
 * @description Procesa un callback de autenticación externo (OAuth, etc.).
 * @param {{ token: string; refreshToken?: string }} input - Tokens validados externamente.
 * @returns {Promise<{ success: true } | { success: false; error: string }>} Resultado del callback.
 */
export async function handleAuthCallback(input: {
  token: string;
  refreshToken?: string;
}) {
  try {
    const cookieStore = await cookies();

    cookieStore.set('auth_token', input.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    if (input.refreshToken) {
      cookieStore.set('refreshToken', input.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[handleAuthCallback] Error:', error);
    return { success: false, error: 'Error al procesar autenticación' };
  }
}
