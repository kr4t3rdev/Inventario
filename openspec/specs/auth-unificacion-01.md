# Spec: Auth unificación — migración a Server Actions + eliminación de sessionStorage

## Resumen

Migrar el sistema de autenticación de Route Handlers a Server Actions, eliminar el almacenamiento de JWT en sessionStorage, y unificar todo el flujo de auth bajo cookies httpOnly.

## Contexto

- Login ya setea cookie `auth_token` con `httpOnly: true`, `secure`, `sameSite: 'lax'`
- `authenticateUser()` en API routes ya acepta cookie como fallback
- `getCurrentUser()` en Server Actions ya lee cookie como mecanismo principal
- El gap es el cliente: `AuthProvider` guarda token en `sessionStorage` y lo envía como Bearer manualmente
- 30+ componentes leen `sessionStorage.getItem('token')` para fetchs manuales

## Reglas (RFC 2119)

1. **MUST** — Las Server Actions nuevas DEBEN autenticar al usuario via `withAction()` (reutilizando `getCurrentUser()`)
2. **MUST** — El login DEBE setear la cookie `auth_token` httpOnly (ya lo hace — verificar que no se rompa)
3. **MUST** — `AuthProvider` NO DEBE almacenar el JWT en sessionStorage después del login exitoso
4. **MUST** — El token de sessionStorage DEBE eliminarse al hacer logout
5. **MUST** — La cookie httpOnly DEBE persistir en logout (el server la elimina)
6. **SHOULD** — Las Route Handlers originales DEBEN mantenerse como thin wrappers que delegan a las Server Actions
7. **SHOULD NOT** — Las rutas de integración externa (Google OAuth, upload, exchange, cron, health, metrics) NO DEBEN migrarse
8. **MAY** — Los componentes que usan sessionStorage para fetchs manuales PUEDEN migrarse a Server Actions o simplemente remover el Bearer header (la cookie viaja automática)

## Escenarios (Given/When/Then)

### Login exitoso
```
Given un usuario con credenciales válidas
When loginAction({ email, password }) se ejecuta
Then se crea una UserSession en DB
And se setea cookie auth_token con httpOnly, secure, sameSite:'lax'
And se devuelve { success: true, data: { user } }
And NO se devuelve el token JWT en el body de respuesta
```

### Login fallido
```
Given un usuario con credenciales inválidas
When loginAction({ email, password }) se ejecuta
Then se incrementa loginAttempts
And se devuelve { success: false, error: { message } }
And NO se setea ninguna cookie
```

### Logout
```
Given un usuario autenticado (cookie auth_token presente)
When logoutAction() se ejecuta
Then se desactivan todas las UserSession activas del usuario
And se elimina la cookie auth_token
And se devuelve { success: true }
```

### Me (usuario actual)
```
Given un usuario autenticado (cookie auth_token presente)
When meAction() se ejecuta
Then se verifica la sesión en DB
And se devuelve { success: true, data: { user } }
```

### Refresh session
```
Given un usuario autenticado con sesión expirada
When refreshSessionAction() se ejecuta
Then se verifica refreshToken
And se crea nueva UserSession
And se renueva cookie auth_token
```

### AuthProvider sin sessionStorage
```
Given un usuario hace login exitoso
When AuthProvider recibe la respuesta
Then NO guarda el token en sessionStorage
And redirige a /busy/dashboard o /admin según rol
And checkAuth usa meAction() en vez de fetch + Bearer
```

### Componente con fetch legacy
```
Given un componente que hace fetch('/api/algo', { headers: { Authorization: Bearer ... } })
When se remueve el header Bearer y el sessionStorage.getItem('token')
Then el fetch funciona igual porque la cookie auth_token se envía automática
```

## Archivos afectados

### Crear
- `src/features/auth/actions.ts` — Server Actions de auth core
- `src/features/auth/actions-onboarding.ts` — Server Actions de onboarding

### Modificar
- `src/contexts/auth-context.tsx` — eliminar sessionStorage, usar Server Actions
- `src/lib/token.ts` — deprecar (no eliminar aún, pueden quedar referencias)
- `src/app/api/auth/login/route.ts` — thin wrapper que delega a loginAction
- `src/app/api/auth/logout/route.ts` — thin wrapper que delega a logoutAction
- `src/app/api/auth/me/route.ts` — thin wrapper que delega a meAction
- `src/app/api/auth/refresh/route.ts` — thin wrapper que delega a refreshSessionAction
- `src/app/api/auth/register/route.ts` — thin wrapper que delega a registerAction
- `src/app/api/auth/verify-email/route.ts` — thin wrapper delega a verifyEmailAction

### No tocar
- `src/app/api/auth/google/*` — OAuth externo
- `src/app/api/upload` — file upload
- `src/app/api/exchange` — tasas externas
- `src/app/api/cron` — webhook
- `src/app/api/health` — monitoreo
- `src/app/api/metrics` — prometheus
- `src/app/api/image` — proxy de imágenes
