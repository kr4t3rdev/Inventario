# Tasks: Auth unificación — Server Actions + eliminación de sessionStorage

## Dependencias

```
T1 (loginAction + logoutAction Server Actions)
  ├── T2 (Route Handler wrappers login/logout)
  │
T3 (meAction + refreshSessionAction Server Actions)
  ├── T4 (Route Handler wrappers me/refresh)
  │
T5 (AuthProvider refactor — sin sessionStorage)
  │
T6 (registerAction + verifyEmailAction Server Actions + wrappers)
  │
T7 (onboarding Server Actions + wrappers)
  │
T8 (Tests TDD — loginAction, logoutAction, meAction, AuthProvider)
  │
T9 (Build + Verify)
```

## T1: Server Actions de auth core (login + logout)

**Archivo a crear:** `src/features/auth/actions.ts`

**Contenido:**
- `loginAction` con validación Zod, verificación de credenciales, rate-limit, creación de UserSession, seteo de cookies httpOnly
- `logoutAction` con desactivación de UserSession, eliminación de cookies

**Criterio:**
- loginAction con credenciales válidas → setea cookie auth_token + refreshToken
- loginAction con credenciales inválidas → ActionError('INVALID_CREDENTIALS')
- logoutAction → elimina cookies, desactiva sesiones

---

## T2: Route Handler wrappers login/logout

**Archivos:**
- `src/app/api/auth/login/route.ts` → thin wrapper que llama a loginAction
- `src/app/api/auth/logout/route.ts` → thin wrapper que llama a logoutAction

**Criterio:** Mantener compatibilidad con clients que llaman a `/api/auth/login` via fetch.

---

## T3: Server Actions me + refresh

**Archivo:** `src/features/auth/actions.ts` (agregar)

- `meAction` → devuelve usuario actual autenticado
- `refreshSessionAction` → refresh token rotation

---

## T4: Route Handler wrappers me/refresh

**Archivos:**
- `src/app/api/auth/me/route.ts` → thin wrapper
- `src/app/api/auth/refresh/route.ts` → thin wrapper

---

## T5: AuthProvider refactor — eliminar sessionStorage

**Archivo:** `src/contexts/auth-context.tsx`

**Cambios:**
- `login()`: llamar `loginAction({ email, password })`, NO guardar token en sessionStorage
- `checkAuth()`: llamar `meAction()` en vez de `fetch('/api/auth/me', { headers: { Authorization } })`
- `logout()`: llamar `logoutAction()` en vez de fetch + sessionStorage.removeItem
- Eliminar `sessionStorage.getItem('token')`, `sessionStorage.setItem('token')`, `sessionStorage.removeItem('token')`

**Criterio:**
- Login exitoso → cookie seteada, sin token en sessionStorage
- Logout → cookie eliminada, user = null
- CheckAuth → funciona sin Bearer header

---

## T6: Server Actions de register + verifyEmail

**Archivo:** `src/features/auth/actions.ts` (agregar)

- `registerAction` → validación, creación de usuario, envío de email
- `verifyEmailAction` → verificación de token de onboarding

**Wrappers:**
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/verify-email/route.ts`

---

## T7: Server Actions de onboarding (postergable, después de Fase 5)

**Archivo a crear:** `src/features/auth/actions-onboarding.ts`

- `onboardingMeAction`
- `onboardingTypeAction`
- `onboardingTenantAction`
- `resendVerificationAction`

**NOTA:** Onboarding usa su propio token (no sessionStorage), no tiene vulnerabilidad XSS. Se migra por consistencia pero puede postergarse.

---

## T8: Tests TDD (strict)

**Archivo a crear:** `src/features/auth/__tests__/actions.test.ts`

**Tests con Vitest:**

### loginAction

```
test('loginAction con credenciales válidas setea cookie auth_token')
test('loginAction con password incorrecto devuelve INVALID_CREDENTIALS')
test('loginAction con usuario inactivo devuelve USER_INACTIVE')
test('loginAction con usuario bloqueado devuelve ACCOUNT_LOCKED')
test('loginAction incrementa loginAttempts en fallo')
```

### logoutAction

```
test('logoutAction desactiva UserSession activas')
test('logoutAction elimina cookie auth_token')
test('logoutAction sin sesión activa no falla')
```

### meAction

```
test('meAction devuelve usuario autenticado')
test('meAction sin token devuelve AUTH_REQUIRED')
```

### AuthProvider

```
test('login no guarda token en sessionStorage')
test('checkAuth funciona sin Bearer header')
```

---

## T9: Build + Verify

- `pnpm run build` exitoso
- Login manual: verificar que login funciona sin sessionStorage
- Logout manual: verificar cookie eliminada
- `grep -r "sessionStorage.getItem.*token" src/contexts/` → 0 ocurrencias
