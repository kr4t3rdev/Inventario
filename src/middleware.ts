import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const url = new URL(request.url)
  const path = url.pathname
  
  console.log('[Middleware] Request:', {
    path,
    method: request.method,
    headers: {
      authorization: request.headers.get('authorization')?.substring(0, 20) + '...'
    }
  })

  // Rutas que NO requieren autenticación (rutas públicas)
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register', 
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/health',
    '/api/planes',
    '/_next',
    '/favicon.ico',
    '/public',
    '/login',
    '/register'
  ]
  
  // Verificar si es una ruta pública
  const isPublicPath = publicPaths.some(publicPath => {
    if (path.startsWith('/_next') || path.startsWith('/favicon') || path.startsWith('/public')) {
      return true
    }
    // Para las rutas de auth, verificar match exacto
    if (publicPath.startsWith('/api/auth/')) {
      return path === publicPath || path.startsWith(publicPath + '/')
    }
    return path === publicPath
  })
  
  console.log('[Middleware] isPublicPath:', isPublicPath, 'for path:', path)
  
  if (isPublicPath) {
    console.log('[Middleware] ✅ Permitiendo acceso a ruta pública')
    return NextResponse.next()
  }
  
  // IMPORTANTE: Solo verificar token para rutas API que NO son públicas
  if (path.startsWith("/api")) {
    console.log('[Middleware] 🔒 Verificando token para API')
    const authorization = request.headers.get("authorization")
    
    console.log('[Middleware] Authorization header:', authorization ? 'Presente' : 'Ausente')
    
    // Si no hay token de autorización, denegar acceso
    if (!authorization || !authorization.startsWith("Bearer ")) {
      console.log('[Middleware] ❌ Token no proporcionado')
      return NextResponse.json({ 
        error: 'Token no proporcionado',
        message: 'Se requiere autenticación para acceder a este recurso'
      }, { status: 401 })
    }
    
    console.log('[Middleware] ✅ Token presente, continuando')
    // La verificación real del token y permisos se hace en cada ruta individual
    return NextResponse.next()
  }
  
  // Para rutas de frontend, permitir el paso
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
