import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from './secrets'
import { checkApiPermission, type UserRole } from './permissions'

/**
 * @description Resultado de autenticación exitosa
 */
export interface AuthenticatedUser {
  userId: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
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

  // 1. Verificar presencia de Authorization header
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: 'Token no proporcionado',
        message:
          'Se requiere autenticación para acceder a este recurso',
      },
      { status: 401 }
    )
  }

  const token = authorization.replace('Bearer ', '').trim()

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

    // 9. Verificar permisos si se solicita
    if (validatePermissions) {
      const permissionError = checkApiPermission(
        user.role,
        validatePermissions.path,
        validatePermissions.method
      )
      if (permissionError) {
        return permissionError
      }
    }

    return { user: user as AuthenticatedUser }
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
  ) => Promise<NextResponse>
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
  ) => Promise<NextResponse>
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
  ) => Promise<NextResponse>
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
