/**
 * @description Obtiene el usuario autenticado actual desde el contexto del servidor
 * para usar dentro de Server Actions y Server Components.
 *
 * A diferencia de authenticateUser() en auth-middleware.ts que usa NextRequest,
 * esta función usa cookies() y headers() de next/headers que están disponibles
 * en Server Actions de Next.js 15+.
 *
 * Estrategia de extracción del token:
 * 1. Cookie 'auth_token' (principal — se seteará durante el login)
 * 2. Header Authorization: Bearer <token> (fallback para transición)
 *
 * @returns {Promise<AuthenticatedUser | null>} Usuario autenticado o null si no hay sesión válida
 */
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import { resolveTenantContext } from '@/lib/auth-middleware';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Extrae el token JWT desde cookies o headers.
 *
 * Prioridad:
 * 1. Cookie 'auth_token' — para Server Actions (el browser envía cookies automáticamente)
 * 2. Header Authorization — para compatibilidad con API routes durante la transición
 *
 * @returns {Promise<string | null>} Token JWT o null si no se encuentra
 */
async function extractToken(): Promise<string | null> {
  // 1. Intentar desde cookie (principal para Server Actions)
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('auth_token')?.value;
  if (cookieToken && cookieToken.split('.').length === 3) {
    return cookieToken;
  }

  // 2. Fallback: header Authorization (transición desde API routes)
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.replace('Bearer ', '').trim();
      if (token.split('.').length === 3) {
        return token;
      }
    }
  } catch {
    // headers() puede lanzar si se llama fuera del contexto de request
    // (ej. durante build time). Ignoramos silenciosamente.
  }

  return null;
}

/**
 * @description Obtiene el usuario autenticado actual.
 *
 * Verifica:
 * 1. Token JWT presente y válido
 * 2. Sesión activa en base de datos y no expirada
 * 3. Usuario existe y está activo
 * 4. Contexto de tenant (membresía activa)
 *
 * @returns {Promise<AuthenticatedUser | null>}
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = await extractToken();
  if (!token) return null;

  try {
    // 1. Verificar y decodificar JWT
    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: string;
      email: string;
      tenantId?: string;
    };

    // 2. Buscar sesión activa en base de datos
    const session = await prisma.userSession.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        userId: true,
      },
    });

    if (!session || !session.isActive) return null;

    // 3. Verificar expiración
    if (session.expiresAt && new Date() > session.expiresAt) {
      // Marcar sesión como inactiva (fire-and-forget)
      void prisma.userSession
        .update({ where: { token }, data: { isActive: false } })
        .catch(() => {});
      return null;
    }

    // 4. Buscar usuario
    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;

    // 5. Resolver contexto de tenant.
    // Usar el tenantId del JWT como hint para mantener consistencia con
    // las API routes (auth-middleware) y con el flujo de refresh.
    // Si la membresía fue desactivada en la DB, resolveTenantContext
    // devuelve null y el user queda sin tenantContext.
    const tenantContext = await resolveTenantContext(
      user.userId,
      decoded.tenantId ?? null,
    );

    const authenticatedUser: AuthenticatedUser = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      // @ts-expect-error: user.role is string in DB but UserRole in runtime
      role: user.role,
      isActive: user.isActive,
      ...(tenantContext && {
        tenantId: tenantContext.tenantId,
        tenantRole: tenantContext.tenantRole,
        planLimits: tenantContext.planLimits,
        planFeatures: tenantContext.planFeatures,
      }),
    };

    return authenticatedUser;
  } catch (error) {
    // JWT expirado o inválido — no es un error, es sesión no válida
    if (error instanceof jwt.JsonWebTokenError) {
      return null;
    }

    // Otros errores (DB, etc.) — loguear pero no propagar
    console.error('[getCurrentUser] Error verificando autenticación:', error);
    return null;
  }
}
