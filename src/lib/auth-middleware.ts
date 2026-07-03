import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from './secrets'
import { checkApiPermission, checkTenantApiPermission, type UserRole } from './permissions'
import { normalizeTenantRole, type TenantRole } from './auth/roles'
import { resolveEffectivePlanFeatures } from './plan-features'

export interface PlanLimits {
  maxUsuarios: number
  maxAlmacenes: number
  maxProductos: number
  maxClientes: number
}

/**
 * @description Resultado de autenticación exitosa.
 * Ahora incluye contexto de tenant cuando está disponible.
 */
export interface AuthenticatedUser {
  userId: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  // Contexto de tenant (opcional — presente si el usuario tiene membresía activa)
  tenantId?: string
  tenantRole?: TenantRole
  planLimits?: PlanLimits
  planFeatures?: Record<string, boolean>
  planName?: string
}

/**
 * @description Resuelve el contexto de tenant para un usuario autenticado.
 * Busca membresía activa; si el request incluye x-tenant-id usa ese, sino el primero activo.
 * @param {string} userId - ID del usuario autenticado.
 * @param {string | null} headerTenantId - Tenant solicitado via header (opcional).
 * @returns {Promise<{ tenantId: string; tenantRole: TenantRole; planLimits?: PlanLimits } | null>}
 */
export async function resolveTenantContext(
  userId: string,
  headerTenantId: string | null,
): Promise<{ tenantId: string; tenantRole: TenantRole; planLimits?: PlanLimits; planFeatures?: Record<string, boolean>; planName?: string; licenseExpiresAt?: Date } | null> {
  try {
    const membership = headerTenantId
      ? await prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: headerTenantId, userId } },
        })
      : await prisma.tenantMembership.findFirst({
          where: { userId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

    if (!membership || !membership.isActive) return null;

    // Obtener límites del plan desde la licencia activa del tenant
    let planLimits: PlanLimits | undefined;
    const license = await prisma.tenantLicense.findFirst({
      where: {
        tenantId: membership.tenantId,
        activa: true,
        expiracion: { gt: new Date() },
      },
      include: {
        plan: {
          select: {
            nombre: true,
            features: true,
          },
        },
      },
      orderBy: { inicio: 'desc' },
    });

    if (license) {
      planLimits = {
        maxUsuarios: license.maxUsuarios,
        maxAlmacenes: license.maxAlmacenes,
        maxProductos: license.maxProductos,
        maxClientes: license.maxClientes,
      };
    }

    const planFeatures = license
      ? resolveEffectivePlanFeatures({
          planFeatures:
            license.plan?.features && typeof license.plan.features === 'object'
              ? (license.plan.features as Record<string, boolean>)
              : undefined,
          featureOverrides:
            license.featureOverrides && typeof license.featureOverrides === 'object'
              ? (license.featureOverrides as Record<string, boolean>)
              : undefined,
          legacyLicenseFeatures:
            license.features && typeof license.features === 'object'
              ? (license.features as Record<string, boolean>)
              : undefined,
        })
      : undefined;

    return {
      tenantId: membership.tenantId,
      tenantRole: normalizeTenantRole(membership.tenantRole) ?? 'dependiente',
      planLimits,
      planFeatures,
      planName: license?.plan?.nombre,
      licenseExpiresAt: license?.expiracion,
    };
  } catch (error) {
    console.error('[Auth] Error resolviendo contexto tenant:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
      userId,
      headerTenantId,
    });
    return null;
  }
}

/**
 * @description Autentica un usuario y verifica su sesión
 * Esta es la ÚNICA función de autenticación en la aplicación
 *
 * @param request - Request de Next.js
 * @param validatePermissions - Opcional: verificar permisos específicos
 * @returns AuthenticatedUser si es exitoso, Response con error si no
 */
export async function authenticateUser(
  request: NextRequest,
  validatePermissions?: { path: string; method: string }
): Promise<{ user: AuthenticatedUser } | Response> {
  const authorization = request.headers.get('authorization')
  let token: string | null = null

  // 1. Intentar desde Authorization header (principal para API routes)
  if (authorization && authorization.startsWith('Bearer ')) {
    token = authorization.replace('Bearer ', '').trim()
  }

  // 2. Fallback: cookie auth_token (para compatibilidad con Server Components)
  if (!token) {
    token = request.cookies.get('auth_token')?.value ?? null
  }

  if (!token) {
    return NextResponse.json(
      {
        error: 'Token no proporcionado',
        message:
          'Se requiere autenticación para acceder a este recurso',
      },
      { status: 401 }
    )
  }

  // 2. Validar formato básico del JWT (tres partes separadas por puntos)
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    console.error('[Auth] Token malformado:', {
      tokenPreview: token?.substring(0, 20) + '...',
    })
    return NextResponse.json(
      {
        error: 'Token inválido',
        message:
          'El token proporcionado no tiene un formato válido',
      },
      { status: 401 }
    )
  }

  try {
    // 3. Verificar y decodificar JWT
    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: string
      email: string
      tenantId?: string
    }

    // 4. Buscar sesión en base de datos
    const session = await prisma.userSession.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        userId: true,
      },
    })

    if (!session || !session.isActive) {
      return NextResponse.json(
        {
          error: 'Sesión no válida',
          message:
            'Su sesión ha sido cerrada o ha expirado. Por favor inicie sesión nuevamente.',
        },
        { status: 401 }
      )
    }

    // 5. Verificar expiración de sesión
    if (session.expiresAt && new Date() > session.expiresAt) {
      await prisma.userSession.update({
        where: { token },
        data: { isActive: false },
      })
      return NextResponse.json(
        {
          error: 'Sesión expirada',
          message:
            'Su sesión ha expirado. Por favor inicie sesión nuevamente.',
        },
        { status: 401 }
      )
    }

    // 6. Buscar usuario
    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          error: 'Usuario no encontrado',
          message:
            'El usuario asociado al token no existe',
        },
        { status: 401 }
      )
    }

    // 7. Verificar que usuario esté activo
    if (!user.isActive) {
      return NextResponse.json(
        {
          error: 'Usuario inactivo',
          message:
            'Su cuenta está desactivada. Contacte al administrador.',
        },
        { status: 403 }
      )
    }

    // 8. Actualizar timestamp de última actividad
    await prisma.userSession.update({
      where: { token },
      data: { lastActive: new Date() },
    })

    // 9. Resolver contexto de tenant
    const requestedTenantId = request.headers.get('x-tenant-id') ?? decoded.tenantId ?? null
    const tenantContext = await resolveTenantContext(user.userId, requestedTenantId)

    if (requestedTenantId && !tenantContext) {
      return NextResponse.json(
        {
          error: 'Contexto de tenant inválido',
          message:
            'El tenant solicitado no existe, no está activo o no pertenece a tu usuario.',
        },
        { status: 403 }
      )
    }

    const authenticatedUser: AuthenticatedUser = {
      ...user,
      ...(tenantContext && {
        tenantId: tenantContext.tenantId,
        tenantRole: tenantContext.tenantRole,
        planLimits: tenantContext.planLimits,
        planFeatures: tenantContext.planFeatures,
        planName: tenantContext.planName,
      }),
    } as AuthenticatedUser

    // 10. Verificar permisos.
    // Si hay contexto tenant, usa permisos tenant. Si no, permisos globales legados.
    if (validatePermissions) {
      const permissionError = tenantContext
        ? checkTenantApiPermission(tenantContext.tenantRole, validatePermissions.path, validatePermissions.method)
        : checkApiPermission(user.role, validatePermissions.path, validatePermissions.method)

      if (permissionError) {
        return permissionError
      }
    }

    return { user: authenticatedUser }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[Auth] JWT error:', error.message)
      return NextResponse.json(
        {
          error: 'Token inválido',
          message:
            'El token proporcionado no es válido o ha expirado',
        },
        { status: 401 }
      )
    }

    console.error('[Auth] Error de autenticación:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        message:
          'Ocurrió un error al verificar tu autenticación',
      },
      { status: 500 }
    )
  }
}

/**
 * @description Wrapper para rutas GET protegidas
 */
export function withAuthGet(
  handler: (
    request: NextRequest,
    context: any,
    user: AuthenticatedUser
  ) => Promise<Response>
) {
  return async (request: NextRequest, context: any) => {
    const result = await authenticateUser(request)

    if ('status' in result) {
      return result as Response
    }

    return handler(request, context, result.user)
  }
}

/**
 * @description Wrapper para rutas POST protegidas
 */
export function withAuthPost(
  handler: (
    request: NextRequest,
    context: any,
    user: AuthenticatedUser
  ) => Promise<Response>
) {
  return async (request: NextRequest, context: any) => {
    const result = await authenticateUser(request)

    if ('status' in result) {
      return result as Response
    }

    return handler(request, context, result.user)
  }
}

/**
 * @description Wrapper genérico que deduce permisos de URL y método
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: any,
    user: AuthenticatedUser
  ) => Promise<Response>
) {
  return async (request: NextRequest, context: any) => {
    const url = new URL(request.url)
    const method = request.method
    const path = url.pathname

    const result = await authenticateUser(request, { path, method })

    if ('status' in result) {
      return result as Response
    }

    return handler(request, context, result.user)
  }
}

/**
 * Verificación específica de permisos para dependientes
 */
export function requireDependienteAccess(
  userRole: string,
  requestedPath: string,
  method: string
): Response | null {
  if (userRole === 'dependiente') {
    // Lista de rutas permitidas para dependientes
    const allowedRoutes = [
      { path: '/api/ventas', methods: ['GET', 'POST'] },
      { path: '/api/venta-servicios', methods: ['GET', 'POST'] },
      { path: '/api/servicios', methods: ['GET'] },
      { path: '/api/reportes-financieros', methods: ['GET'] },
    ]

    const allowedRoute = allowedRoutes.find(route => {
      if (requestedPath.startsWith(route.path)) {
        return route.methods.includes(method)
      }
      return false
    })

    if (!allowedRoute) {
      return NextResponse.json({
        error: 'Acceso restringido para dependientes',
        message: 'Los dependientes solo pueden acceder a ventas, servicios y reportes',
        allowedRoutes: allowedRoutes.map(r => `${r.methods.join(', ')} ${r.path}`)
      }, { status: 403 })
    }
  }

  return null
}
