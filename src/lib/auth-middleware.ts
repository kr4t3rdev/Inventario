import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import jwt from 'jsonwebtoken'
import { checkApiPermission, type UserRole } from './permissions'

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

/**
 * Resultado de autenticación
 */
interface AuthResult {
  user: any
}

/**
 * Autentica y verifica permisos para rutas API
 * @param request - Request de Next.js
 * @param requiredPermissions - Permisos requeridos (opcional, se infiere de la URL y método)
 * @returns Response de error si no autorizado, o objeto user si autorizado
 */
export async function authenticateAndAuthorize(
  request: NextRequest,
  requiredPermissions?: { path: string; method: string }
): Promise<AuthResult | Response> {
  const authorization = request.headers.get("authorization")

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return NextResponse.json({
      error: 'Token no proporcionado',
      message: 'Se requiere autenticación para acceder a este recurso'
    }, { status: 401 })
  }

  const token = authorization.replace("Bearer ", "").trim()

  // Validar formato básico del JWT
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    console.error('Token malformado: formato inválido', { token: token?.substring(0, 50) + '...' })
    return NextResponse.json({
      error: 'Token inválido',
      message: 'El token proporcionado no tiene un formato válido'
    }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, email: string }

    const session = await prisma.userSession.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        userId: true,
      },
    })

    if (!session || !session.isActive) {
      return NextResponse.json({
        error: 'Sesión no válida',
        message: 'Su sesión ha sido cerrada o ha expirado. Por favor inicie sesión nuevamente.'
      }, { status: 401 })
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      await prisma.userSession.update({
        where: { token },
        data: { isActive: false },
      })
      return NextResponse.json({
        error: 'Sesión expirada',
        message: 'Su sesión ha expirado. Por favor inicie sesión nuevamente.'
      }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      },
    })

    if (!user) {
      return NextResponse.json({
        error: 'Usuario no encontrado',
        message: 'El usuario asociado al token no existe'
      }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({
        error: 'Usuario inactivo',
        message: 'Su cuenta está desactivada. Contacte al administrador.'
      }, { status: 403 })
    }

    await prisma.userSession.update({
      where: { token },
      data: { lastActive: new Date() },
    })

    // Verificar permisos si se proporcionan
    if (requiredPermissions) {
      const permissionCheck = checkApiPermission(
        user.role as UserRole,
        requiredPermissions.path,
        requiredPermissions.method
      )

      if (permissionCheck) {
        return permissionCheck
      }
    }

    return { user }
  } catch (error) {
    console.error('Error de autenticación:', error, { tokenPreview: token?.substring(0, 50) + '...' })
    return NextResponse.json({
      error: 'Token inválido',
      message: 'El token proporcionado no es válido o ha expirado'
    }, { status: 401 })
  }
}
export function withAuthGet(
  handler: (request: NextRequest, context: any, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    const authResult = await authenticateAndAuthorize(request)

    // Verificar si es un Response (error) o AuthResult (éxito)
    if ('status' in authResult) {
      return authResult as Response
    }

    return handler(request, context, (authResult as AuthResult).user)
  }
}

/**
 * Wrapper para rutas POST que requiere autenticación y autorización
 */
export function withAuthPost(
  handler: (request: NextRequest, context: any, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    const authResult = await authenticateAndAuthorize(request)

    // Verificar si es un Response (error) o AuthResult (éxito)
    if ('status' in authResult) {
      return authResult as Response
    }

    return handler(request, context, (authResult as AuthResult).user)
  }
}

/**
 * Wrapper genérico que deduce permisos de la URL y método
 */
export function withAuth(
  handler: (request: NextRequest, context: any, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    const url = new URL(request.url)
    const method = request.method
    const path = url.pathname

    const authResult = await authenticateAndAuthorize(request, { path, method })

    // Verificar si es un Response (error) o AuthResult (éxito)
    if ('status' in authResult) {
      return authResult as Response
    }

    return handler(request, context, (authResult as AuthResult).user)
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