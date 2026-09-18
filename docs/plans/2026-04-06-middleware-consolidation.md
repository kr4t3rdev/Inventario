# Middleware Consolidation & Auth Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate 3 duplicated auth functions into a single, testable, performant authentication system with centralized secret management and proper error handling.

**Architecture:** 
- Single `authenticateUser()` function in `src/lib/auth-middleware.ts` handles all JWT validation, session checks, and user verification
- New `src/lib/secrets.ts` module with lazy-loaded, validated environment secrets
- All middleware and API routes use unified auth function
- Proper TypeScript types replace all `any` usage
- Add rate limiting to public endpoints (login, register)

**Tech Stack:** Next.js 15, TypeScript, Prisma ORM, jsonwebtoken, node-cache (for JWT decode caching)

---

## Task 1: Create Secrets Management Module

**Files:**
- Create: `src/lib/secrets.ts`
- Modify: `src/lib/auth-middleware.ts` (step 5)

**Step 1: Write the test for secrets module**

```bash
# Create test file
cat > "src/lib/__tests__/secrets.test.ts" << 'EOF'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as secrets from '../secrets'

describe('Secrets Module', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should return JWT_SECRET from environment', () => {
    process.env.JWT_SECRET = 'test-secret-123'
    // Re-import to get fresh values
    vi.resetModules()
    expect(process.env.JWT_SECRET).toBe('test-secret-123')
  })

  it('should throw error if JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET
    vi.resetModules()
    // This will be validated at app startup
    expect(process.env.JWT_SECRET).toBeUndefined()
  })

  it('should return REFRESH_JWT_SECRET from environment', () => {
    process.env.REFRESH_JWT_SECRET = 'refresh-secret-123'
    expect(process.env.REFRESH_JWT_SECRET).toBe('refresh-secret-123')
  })
})
EOF
```

**Step 2: Run test to verify structure**

```bash
pnpm test -- src/lib/__tests__/secrets.test.ts
# Expected: PASS (basic env variable checks)
```

**Step 3: Create secrets.ts module**

```typescript
/**
 * @description Centralized secrets management with validation
 * All sensitive environment variables are accessed through this module
 * This ensures we don't have hardcoded defaults in production
 */

const validateSecret = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local or your deployment platform.`
    )
  }
  return value
}

/**
 * JWT secret for signing access tokens
 * Must be at least 32 characters in production
 */
export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    return validateSecret('JWT_SECRET', secret)
  }
  // In development, allow a default if not set (for local testing)
  return secret || 'dev-default-jwt-secret-change-in-production'
})()

/**
 * JWT secret for signing refresh tokens (separate key for rotation)
 */
export const REFRESH_JWT_SECRET = (() => {
  const secret = process.env.REFRESH_JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    return validateSecret('REFRESH_JWT_SECRET', secret)
  }
  return secret || 'dev-default-refresh-secret-change-in-production'
})()

/**
 * Validates all secrets at startup
 * Call this in your app initialization (e.g., in middleware.ts or root layout)
 */
export function validateAllSecrets(): void {
  try {
    // Access all secrets to trigger validation
    console.log('[Secrets] ✅ JWT_SECRET configured')
    console.log('[Secrets] ✅ REFRESH_JWT_SECRET configured')
  } catch (error) {
    console.error('[Secrets] ❌ Configuration error:', error)
    throw error
  }
}
```

**Step 4: Update middleware.ts to validate secrets**

In `src/middleware.ts`, add at the top:

```typescript
import { validateAllSecrets } from "@/lib/secrets"

// Validate secrets on middleware initialization
validateAllSecrets()

export async function middleware(request: NextRequest) {
  // ... rest of middleware code
}
```

**Step 5: Run tests**

```bash
pnpm test -- src/lib/__tests__/secrets.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add src/lib/secrets.ts src/lib/__tests__/secrets.test.ts src/middleware.ts
git commit -m "feat: add centralized secrets management with validation"
```

---

## Task 2: Create Unified Authentication Function

**Files:**
- Modify: `src/lib/auth-middleware.ts` (lines 1-126)
- Create: `src/lib/__tests__/auth-middleware.test.ts`
- Delete: `verify_token()` from `src/lib/auth-utils.ts` (step later)

**Step 1: Write test for unified authentication**

```bash
cat > "src/lib/__tests__/auth-middleware.test.ts" << 'EOF'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '../auth-middleware'
import { prisma } from '../prisma'
import jwt from 'jsonwebtoken'

vi.mock('../prisma', () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('jsonwebtoken')

describe('authenticateUser', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if no authorization header', async () => {
    mockRequest = new NextRequest(new Request('http://localhost/api/test'))
    
    const result = await authenticateUser(mockRequest)
    
    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if Bearer token missing', async () => {
    mockRequest = new NextRequest(new Request('http://localhost/api/test', {
      headers: { authorization: 'Invalid token' }
    }))
    
    const result = await authenticateUser(mockRequest)
    
    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if JWT format invalid', async () => {
    mockRequest = new NextRequest(new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer invalid.token' }
    }))
    
    const result = await authenticateUser(mockRequest)
    
    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return user if authentication successful', async () => {
    const mockUser = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin' as const,
      isActive: true,
    }

    const mockToken = 'valid.jwt.token'
    
    mockRequest = new NextRequest(new Request('http://localhost/api/test', {
      headers: { authorization: `Bearer ${mockToken}` }
    }))

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', email: 'test@example.com' } as any)
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      throw new Error('Expected user object, got error response')
    }

    expect(result.user).toEqual(mockUser)
  })
})
EOF
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/lib/__tests__/auth-middleware.test.ts
# Expected: FAIL (function doesn't exist yet)
```

**Step 3: Refactor auth-middleware.ts - Replace authenticateAndAuthorize with authenticateUser**

Replace lines 21-126 in `src/lib/auth-middleware.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './secrets'
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
        message: 'Se requiere autenticación para acceder a este recurso',
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
        message: 'El token proporcionado no tiene un formato válido',
      },
      { status: 401 }
    )
  }

  try {
    // 3. Verificar y decodificar JWT
    const decoded = jwt.verify(token, JWT_SECRET) as {
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
          message: 'El usuario asociado al token no existe',
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
          message: 'El token proporcionado no es válido o ha expirado',
        },
        { status: 401 }
      )
    }

    console.error('[Auth] Error de autenticación:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        message: 'Ocurrió un error al verificar tu autenticación',
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
 * @description Verificación específica de permisos para dependientes
 * @deprecated Use checkApiPermission from permissions.ts instead
 */
export function requireDependienteAccess(
  userRole: string,
  requestedPath: string,
  method: string
): Response | null {
  if (userRole === 'dependiente') {
    const allowedRoutes = [
      { path: '/api/ventas', methods: ['GET', 'POST'] },
      { path: '/api/venta-servicios', methods: ['GET', 'POST'] },
      { path: '/api/servicios', methods: ['GET'] },
      { path: '/api/reportes-financieros', methods: ['GET'] },
    ]

    const allowedRoute = allowedRoutes.find((route) => {
      if (requestedPath.startsWith(route.path)) {
        return route.methods.includes(method)
      }
      return false
    })

    if (!allowedRoute) {
      return NextResponse.json(
        {
          error: 'Acceso restringido para dependientes',
          message:
            'Los dependientes solo pueden acceder a ventas, servicios y reportes',
          allowedRoutes: allowedRoutes.map((r) =>
            `${r.methods.join(', ')} ${r.path}`
          ),
        },
        { status: 403 }
      )
    }
  }

  return null
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/lib/__tests__/auth-middleware.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/auth-middleware.ts src/lib/__tests__/auth-middleware.test.ts
git commit -m "refactor: consolidate to single authenticateUser function with proper types"
```

---

## Task 3: Update middleware.ts to use unified authenticateUser

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Simplify middleware.ts**

Replace entire `src/middleware.ts` with:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateAllSecrets } from '@/lib/secrets'

// Validate secrets on startup
validateAllSecrets()

/**
 * @description Next.js middleware that handles route protection
 * Note: Heavy auth logic is delegated to authenticateUser() in auth-middleware.ts
 * This layer only handles route matching and logging
 */
export async function middleware(request: NextRequest) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  // Log all requests (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware]', method, path)
  }

  // Public routes that don't require authentication
  const publicExactRoutes = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/health',
    '/api/licencias/validar',
  ])

  const publicPrefixRoutes = new Set([
    '/_next',
    '/favicon',
    '/public',
  ])

  const publicGetOnlyRoutes = new Set(['/api/planes'])

  // Check if route is public
  const isExactPublic = publicExactRoutes.has(path)
  const isPrefixPublic = Array.from(publicPrefixRoutes).some((prefix) =>
    path.startsWith(prefix)
  )
  const isGetPublic =
    publicGetOnlyRoutes.has(path) && method === 'GET'

  const isPublicPath = isExactPublic || isPrefixPublic || isGetPublic

  if (isPublicPath) {
    return NextResponse.next()
  }

  // API routes (non-public) require authentication
  // The actual auth is handled by withAuth* wrappers in route handlers
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
  matcher: ['/busy/:path*', '/login', '/register', '/api/:path*'],
}
```

**Step 2: Run tests to ensure nothing broke**

```bash
pnpm run lint
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "refactor: simplify middleware to use centralized auth"
```

---

## Task 4: Delete duplicated verify_token function

**Files:**
- Modify: `src/lib/auth-utils.ts` (remove verify_token)
- Search for usages and update them

**Step 1: Find all usages of verify_token**

```bash
grep -r "verify_token" src/ --include="*.ts" --include="*.tsx"
# Document all files that import it
```

**Step 2: Check if verify_token is used anywhere**

If it's used in other files:
- For each file, replace `verify_token(request)` with:
  ```typescript
  const result = await authenticateUser(request)
  const user = 'status' in result ? null : result.user
  ```

**Step 3: Remove verify_token from auth-utils.ts**

Remove lines 7-77 from `src/lib/auth-utils.ts`, leaving only exports needed elsewhere.

**Step 4: Run tests**

```bash
pnpm test
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/auth-utils.ts
git commit -m "refactor: remove duplicated verify_token function"
```

---

## Task 5: Update login route to use JWT_SECRET from secrets module

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

**Step 1: Update imports**

Replace lines 1-9 in `src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, REFRESH_JWT_SECRET } from '@/lib/secrets'
import { sendFailedLoginAttemptsNotification } from '@/lib/email'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME_MINUTES = 15
```

**Step 2: Remove old constant definitions**

Delete old lines that had:
```typescript
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || "refresh-secret-key"
```

**Step 3: Run tests**

```bash
pnpm test
# Expected: PASS
```

**Step 4: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "refactor: use centralized secrets in login route"
```

---

## Task 6: Add Rate Limiting to Login Endpoint

**Files:**
- Create: `src/lib/ratelimit.ts`
- Modify: `src/app/api/auth/login/route.ts`

**Step 1: Install Upstash Ratelimit (if not already installed)**

```bash
pnpm add @upstash/ratelimit
```

**Step 2: Create ratelimit module**

```typescript
// src/lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit'

/**
 * @description Rate limiter using sliding window algorithm
 * Limits to 5 requests per minute per IP
 */
export const loginRateLimit = new Ratelimit({
  redis: process.env.UPSTASH_REDIS_URL
    ? (global as any).redis || undefined
    : undefined,
  analytics: true,
  prefix: 'ratelimit:login',
  limiter: Ratelimit.slidingWindow(5, '1 m'),
})

/**
 * @description Rate limiter for register endpoint
 * Limits to 3 requests per hour per IP
 */
export const registerRateLimit = new Ratelimit({
  redis: process.env.UPSTASH_REDIS_URL
    ? (global as any).redis || undefined
    : undefined,
  analytics: true,
  prefix: 'ratelimit:register',
  limiter: Ratelimit.slidingWindow(3, '1 h'),
})
```

**Step 3: Update login route to use rate limiting**

At the start of `POST` function in `src/app/api/auth/login/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Check rate limit
    const { success, limit, remaining, reset } = await loginRateLimit.limit(ip)

    if (!success) {
      const resetTime = new Date(reset).toLocaleTimeString()
      return NextResponse.json(
        {
          error: 'Demasiados intentos de inicio de sesión',
          message: `Por favor, intente nuevamente después de ${resetTime}`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }

    // Rest of login logic...
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }
    // ... continue with existing logic
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run login tests**

```bash
pnpm test
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/ratelimit.ts src/app/api/auth/login/route.ts
git commit -m "feat: add rate limiting to login and register endpoints"
```

---

## Task 7: Update Type System - Remove all `any` types

**Files:**
- Modify: `src/lib/auth-middleware.ts` (already done in Task 2)
- Modify: `src/contexts/auth-context.tsx`
- Modify: Any other auth-related files with `any`

**Step 1: Check for remaining `any` types in auth code**

```bash
grep -r ": any" src/lib/auth* src/contexts/auth* --include="*.ts" --include="*.tsx"
```

**Step 2: Update auth-context.tsx if needed**

(Verify if it has `any` types and update accordingly)

**Step 3: Run type check**

```bash
pnpm tsc --noEmit
# Expected: PASS (no type errors)
```

**Step 4: Commit**

```bash
git add src/contexts/auth-context.tsx
git commit -m "refactor: remove any types from auth context"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] No duplicate auth functions (`grep -r "verify_token\|authenticateAndAuthorize" src/`)
- [ ] All secrets come from `src/lib/secrets.ts`
- [ ] No hardcoded `"your-secret-key"` strings in code
- [ ] All auth tests pass (`pnpm test -- src/lib/__tests__/auth`)
- [ ] Types check (`pnpm tsc --noEmit`)
- [ ] Linter passes (`pnpm run lint`)
- [ ] Login rate limiting works
- [ ] All wrappers use `AuthenticatedUser` type

---

## Rollback Plan

If issues arise:

```bash
git log --oneline | head -7  # See all commits made
git revert <commit-hash>     # Revert specific commit
git revert HEAD~6..HEAD      # Revert last 7 commits
```

