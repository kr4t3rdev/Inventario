import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method
  
  console.log('[Middleware] Request:', {
    path,
    method,
    headers: {
      authorization: request.headers.get('authorization')?.substring(0, 20) + '...'
    }
  })

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
  
  const isPublicPath = isExactPublic || isPrefixPublic || isGetPublic
  
  console.log('[Middleware] isPublicPath:', isPublicPath, 'for path:', path)
  
  if (isPublicPath) {
    console.log('[Middleware] ✅ Permitiendo acceso a ruta pública')
    return NextResponse.next()
  }
  
  if (path.startsWith("/api")) {
    console.log('[Middleware] 🔒 Verificando token para API')
    const authorization = request.headers.get("authorization")
    
    console.log('[Middleware] Authorization header:', authorization ? 'Presente' : 'Ausente')
    
    if (!authorization || !authorization.startsWith("Bearer ")) {
      console.log('[Middleware] ❌ Token no proporcionado')
      return NextResponse.json({ 
        error: 'Token no proporcionado',
        message: 'Se requiere autenticación para acceder a este recurso'
      }, { status: 401 })
    }
    
    console.log('[Middleware] ✅ Token presente, continuando')
    return NextResponse.next()
  }
  
  console.log('[Middleware] ✅ Ruta de frontend, permitiendo paso')
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/busy/:path*',
    '/login',
    '/register',
    '/api/:path*'
  ]
}
