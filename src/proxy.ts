import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateAllSecrets } from '@/lib/secrets'

// Validar secretos al iniciar el proxy (falla rápido si faltan vars de entorno)
validateAllSecrets()

/**
 * @description Proxy de Next.js que maneja la protección de rutas.
 * La lógica pesada de autenticación (JWT + sesión + usuario) está delegada
 * a los wrappers `withAuth*` en cada route handler.
 * Este nivel solo hace verificación de presencia del token.
 * @param {NextRequest} request - Request entrante de Next.js
 * @returns {Promise<NextResponse>} Respuesta que permite o bloquea el acceso
 */
export async function proxy(request: NextRequest) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (process.env.NODE_ENV === 'development') {
    console.log('[Proxy]', method, path)
  }

  // Rutas públicas que no requieren token
  const publicPathsExact = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/health',
    '/api/licencias/validar',
  ]

  const publicPathsPrefix = [
    '/_next',
    '/favicon',
    '/public',
  ]

  const publicGetOnly = [
    '/api/planes',
  ]

  const isExactPublic = publicPathsExact.some(p => path === p || path.startsWith(p + '/'))
  const isPrefixPublic = publicPathsPrefix.some(p => path.startsWith(p))
  const isGetPublic = publicGetOnly.includes(path) && method === 'GET'

  if (isExactPublic || isPrefixPublic || isGetPublic) {
    return NextResponse.next()
  }

  // Rutas API protegidas: verificar presencia del Bearer token
  // La validación completa (JWT + sesión + permisos) la hacen los wrappers withAuth*
  if (path.startsWith('/api')) {
    const authorization = request.headers.get('authorization')

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'Token no proporcionado',
          message: 'Se requiere autenticación para acceder a este recurso',
        },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/busy/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
}