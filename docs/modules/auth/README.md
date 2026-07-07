# Autenticación

> Gestiona el acceso web, el acceso mobile, el refresh de sesión y el onboarding inicial de usuarios y tenants.

## Qué hace

Este módulo resuelve todo el ciclo de acceso al sistema:

- login web con cookies `httpOnly`
- login mobile con tokens en JSON
- refresh automático de sesión usando `refreshToken`
- cambio de tenant activo cuando una persona pertenece a más de una empresa
- callback de autenticación externa
- onboarding posterior al registro

## Qué incluye

- login web con cookies
- login mobile con tokens en JSON
- refresh y logout
- cambio de tenant activo
- callback de autenticación externa
- onboarding inicial de usuario

## Reglas importantes

- El login web y el mobile no comparten el mismo mecanismo de persistencia.
- El refresh depende de la cookie `refreshToken`; si falta, la sesión se considera expirada.
- Un usuario puede autenticarse bien pero quedar frenado por licencia, tenant o onboarding pendiente.
- El cambio de tenant activo modifica el contexto completo del usuario.

## Flujos principales

### Login web

- `loginAction` valida credenciales y no devuelve el JWT en el body.
- La sesión se persiste en cookies seguras: `auth_token` y `refreshToken`.
- Si el usuario está inactivo, bloqueado o sin tenant habilitado, el acceso se rechaza.

### Login mobile

- `POST /api/mobile/v1/auth/login` usa la misma lógica de autenticación.
- Devuelve `accessToken` y `refreshToken` en JSON.
- No usa cookies, porque el cliente mobile administra los tokens.

### Refresh y cierre de sesión

- `refreshSessionAction` renueva la sesión usando la cookie `refreshToken`.
- Si el refresh falla o expiró, borra cookies y obliga a reingresar.
- `logoutAction` invalida la sesión y limpia cookies.

### Cambio de tenant activo

- `getMyTenantsAction` lista las empresas a las que tiene acceso el usuario.
- `switchActiveTenantAction` cambia el tenant activo y reescribe las cookies.
- Esto impacta permisos, features disponibles y alcance multi-tenant.

### Onboarding

- El flujo `/onboarding` guía al usuario después del registro.
- El backend maneja estados como `selecting_user_type`, `selecting_tenant`, `awaiting_manager_approval` y `awaiting_global_approval`.
- Los endpoints de onboarding viven en `/api/auth/onboarding/*`.

## Cuándo usarlo

- Cuando una persona no puede iniciar sesión o perdió el acceso.
- Cuando hay que cambiar de empresa activa sin cerrar sesión.
- Cuando querés verificar en qué paso del onboarding quedó un usuario nuevo.
- Cuando una app mobile necesita autenticarse sin cookies.

## Qué conviene cuidar

- Si un problema parece de permisos, muchas veces en realidad viene de tenant activo o onboarding.
- Conviene distinguir claramente errores de credenciales, sesión y licenciamiento.

## Rutas y referencias

- `src/features/auth/actions.ts`
- `src/features/auth/api/handlers.ts`
- `src/app/api/mobile/v1/auth/login/route.ts`
- `src/app/onboarding/page.tsx`

## En una frase

Centraliza cómo entra, mantiene y completa su acceso cada usuario en web y mobile.
