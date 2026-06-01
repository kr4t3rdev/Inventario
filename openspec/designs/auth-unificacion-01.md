# Design: Auth unificación — Server Actions + eliminación de sessionStorage

## Orden de ejecución

```
1. Crear Server Actions de auth core (loginAction, logoutAction, meAction, refreshSessionAction)
2. Migrar Route Handlers de auth core a thin wrappers
3. Crear Server Actions de auth secundario (registerAction, verifyEmailAction)
4. Migrar Route Handlers de auth secundario a thin wrappers
5. Crear Server Actions de onboarding (onboardingMeAction, onboardingTypeAction, onboardingTenantAction, resendVerificationAction)
6. Migrar Route Handlers de onboarding a thin wrappers
7. Refactor AuthProvider: eliminar sessionStorage, usar Server Actions
8. Tests TDD
```

---

## Fase 1: Server Actions de auth core

### `src/features/auth/actions.ts`

Estructura:

```typescript
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getJwtSecret, getRefreshJwtSecret } from '@/lib/secrets';
import { resolveTenantContext } from '@/lib/auth-middleware';
import { normalizeUserRole } from '@/lib/auth/roles';
import { checkRateLimit } from '@/lib/rate-limit';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
```

**loginAction:**

```typescript
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const loginAction = withAction(async (input: z.infer<typeof loginSchema>) => {
  const parsed = loginSchema.parse(input);
  const { email, password } = parsed;

  // Buscar usuario
  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, name: true, email: true, password: true, role: true, isActive: true, expiresAt: true, lockedUntil: true, loginAttempts: true, onboardingStatus: true },
  });

  if (!user) throw new ActionError('Credenciales inválidas', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw new ActionError('Usuario inactivo', 'USER_INACTIVE');

  // Verificar password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    // Incrementar intentos, bloquear si corresponde
    // ... (misma lógica que el handler actual)
    throw new ActionError('Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  // Resetear intentos
  await prisma.user.update({ where: { userId: user.userId }, data: { loginAttempts: 0, lockedUntil: null } });

  // Resolver tenant
  const tenantContext = await resolveTenantContext(user.userId, null);

  // Generar JWT
  const token = jwt.sign({ userId: user.userId, email: user.email, ...(tenantContext && { tenantId: tenantContext.tenantId }) }, getJwtSecret(), { expiresIn: '30d' });
  const refreshToken = jwt.sign({ userId: user.userId, email: user.email, refreshId: Date.now() }, getRefreshJwtSecret(), { expiresIn: '30d' });

  // Crear sesión
  await prisma.userSession.create({
    data: { userId: user.userId, token, isActive: true, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });

  // Setear cookies (httpOnly)
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
  cookieStore.set('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });

  // Devolver user (NUNCA el token)
  const { password: _, ...userWithoutPassword } = user;
  return {
    user: { ...userWithoutPassword, ...(tenantContext && { tenantId: tenantContext.tenantId, tenantRole: tenantContext.tenantRole }) },
  };
});
```

**logoutAction:**

```typescript
export const logoutAction = withAction(async (_void: void, user: AuthenticatedUser) => {
  await prisma.userSession.updateMany({
    where: { userId: user.userId, isActive: true },
    data: { isActive: false },
  });

  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  cookieStore.delete('refreshToken');

  revalidatePath('/login');
  return { success: true };
});
```

**meAction:**

```typescript
export const meAction = withAction(async (_void: void, user: AuthenticatedUser) => {
  const dbUser = await prisma.user.findUnique({
    where: { userId: user.userId },
    select: { userId: true, name: true, email: true, role: true, isActive: true },
  });

  if (!dbUser) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');

  return { user: { ...dbUser, tenantId: user.tenantId, tenantRole: user.tenantRole } };
});
```

**refreshSessionAction:**

```typescript
const refreshSchema = z.object({}).optional();

export const refreshSessionAction = withAction(async (_void: void) => {
  // Leer refreshToken desde cookie
  const cookieStore = await cookies();
  const refreshTokenCookie = cookieStore.get('refreshToken');
  if (!refreshTokenCookie) throw new ActionError('Refresh token no encontrado', 'AUTH_REQUIRED');

  try {
    const payload = jwt.verify(refreshTokenCookie.value, getRefreshJwtSecret()) as { userId: string; email: string; };
    // Verificar usuario activo
    const user = await prisma.user.findUnique({ where: { userId: payload.userId }, select: { userId: true, isActive: true, expiresAt: true } });
    if (!user || !user.isActive) throw new ActionError('Usuario inactivo', 'USER_INACTIVE');

    // Generar nuevos tokens
    const newToken = jwt.sign({ userId: user.userId, email: payload.email }, getJwtSecret(), { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user.userId, email: payload.email, refreshId: Date.now() }, getRefreshJwtSecret(), { expiresIn: '30d' });

    // Actualizar sesión
    await prisma.userSession.deleteMany({ where: { userId: user.userId } });
    await prisma.userSession.create({
      data: { userId: user.userId, token: newRefreshToken, isActive: true, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    cookieStore.set('auth_token', newToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 900 }); // 15 min
    cookieStore.set('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });

    return { success: true };
  } catch (err) {
    cookieStore.delete('auth_token');
    cookieStore.delete('refreshToken');
    throw new ActionError('Sesión expirada', 'SESSION_EXPIRED');
  }
});
```

## Fase 2: Thin wrappers en Route Handlers

Cada `route.ts` de auth se convierte en:

```typescript
// src/app/api/auth/login/route.ts
import { loginAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Delegar a Server Action
  const { searchParams } = new URL(request.url);
  const body = await request.json();
  
  try {
    const result = await loginAction(body);
    if (result.success) {
      return Response.json({ ...result.data, token: undefined }); // nunca exponer token
    }
    return Response.json({ error: result.error?.message }, { status: 401 });
  } catch (error) {
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
```

**NOTA:** Las Route Handlers originales tenían lógica compleja (loginAttempts, notificaciones, rate-limiting). Esa lógica se COPIA a la Server Action y se mantiene en la Route Handler como respaldo.

## Fase 3: AuthProvider sin sessionStorage

```typescript
// src/contexts/auth-context.tsx (refactor)
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { loginAction, logoutAction, meAction } from '@/features/auth/actions';
import type { Usuario } from '@/app/models/model';

interface AuthContextType {
  user: Usuario | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

// checkAuth usa meAction() en vez de fetch + Bearer
// login NO guarda token en sessionStorage
// logout usa logoutAction() que elimina la cookie
```

## Fase 4: Migración de componentes con sessionStorage

Para cada componente que hace:
```typescript
const token = sessionStorage.getItem('token');
fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

Se reemplaza por:
```typescript
fetch(url); // La cookie auth_token se envía automática
```

O mejor aún, se migra a Server Action si es una mutación.

## Estrategia de testing TDD

Se escribirán tests con Vitest para:

1. `loginAction` — éxito, contraseña incorrecta, usuario inactivo, rate-limit
2. `logoutAction` — éxito, usuario no autenticado
3. `meAction` — usuario autenticado, token inválido
4. `AuthProvider` — login no guarda en sessionStorage
5. Integración: login → cookie seteada → meAction funciona

## Rollback

Mantener las Route Handlers originales como respaldo. Si algo falla:
1. Revertir `AuthProvider` a la versión anterior
2. Las Route Handlers siguen funcionando con cookies
3. `git checkout` de archivos individuales

## Archivos a crear
- `src/features/auth/actions.ts` (~300 líneas)

## Archivos a modificar
- `src/contexts/auth-context.tsx` (~150 líneas modificadas)
- `src/app/api/auth/login/route.ts` (~10 líneas)
- `src/app/api/auth/logout/route.ts` (~10 líneas)
- `src/app/api/auth/me/route.ts` (~10 líneas)
- `src/app/api/auth/refresh/route.ts` (~10 líneas)
- `src/app/api/auth/register/route.ts` (~10 líneas)
- `src/app/api/auth/verify-email/route.ts` (~10 líneas)
- `src/features/auth/api/__tests__/actions.test.ts` (~150 líneas)

## Archivos a no tocar
- `src/lib/auth-middleware.ts`
- `src/lib/server-actions/with-action.ts`
- `src/lib/server-actions/get-current-user.ts`
- `src/lib/token.ts` (deprecado pero no eliminado)
- Todas las rutas `/api/*` que no son auth
