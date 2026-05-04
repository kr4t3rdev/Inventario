# Multi-Tenant Platform: Onboarding Hardening

## Purpose
Especifica el endurecimiento del flujo de onboarding multi-tenant: seguridad en endpoints públicos, aprobación de membresías, y manejo de estados transicionales en login.

## Requirements

### Requirement: Onboarding Login Bypass
The system MUST permitir login a usuarios en estados de onboarding previos a la activación, sin conceder acceso operativo hasta que el manager apruebe.

#### Scenario: Usuario mid-onboarding hace login
- GIVEN un usuario con `onboardingStatus: 'awaiting_manager_approval'` y `isActive: false`
- WHEN intenta hacer login con credenciales válidas
- THEN el sistema MUST devolver un token JWT sin contexto tenant
- AND el `AuthenticatedUser.isActive` y `onboardingStatus` van en el payload para que el frontend muestre estado

#### Scenario: Usuario activado hace login normal
- GIVEN un usuario con `isActive: true` y membresía activa
- WHEN hace login
- THEN el sistema MUST devolver token JWT con tenantId y tenantRole como antes

### Requirement: Rate Limiting on Public Endpoints
The system MUST limitar requests a endpoints de registro y onboarding para prevenir abuso.

#### Scenario: Registro con rate limit
- GIVEN un endpoint `/api/auth/register` con rate limit de N requests por ventana
- WHEN se excede el límite desde una misma IP
- THEN el sistema MUST responder 429 Too Many Requests

#### Scenario: Verify email con rate limit
- GIVEN endpoint `/api/auth/verify-email` con rate limit
- WHEN se excede el límite
- THEN el sistema MUST responder 429

### Requirement: Manager Membership Approval
The system MUST proveer endpoints admin para que managers aprueben o rechacen solicitudes de membresía pendientes.

#### Scenario: Manager lista membresías pendientes
- GIVEN un usuario autenticado con `tenantRole: manager` o `admin` y tenant activo
- WHEN consulta GET `/api/admin/memberships/pending`
- THEN el sistema MUST devolver membresías con `isActive: false` del tenant

#### Scenario: Manager aprueba membresía
- GIVEN una membresía pendiente en su tenant
- WHEN el manager hace PATCH con `{ action: 'approve', tenantRole: 'dependiente' }`
- THEN el sistema MUST activar la membresía y actualizar el User
- AND MUST notificar al usuario

#### Scenario: Manager rechaza membresía
- GIVEN una membresía pendiente
- WHEN el manager hace PATCH con `{ action: 'reject' }`
- THEN el sistema MUST eliminar la membresía y resetear onboardingStatus del user

### Requirement: Resend Verification Email
The system MUST permitir reenviar el email de verificación si el token expiró.

#### Scenario: Reenvío de verificación
- GIVEN un usuario con `onboardingStatus: 'pending_email_verification'`
- WHEN hace POST `/api/auth/onboarding/resend-verification` con email
- THEN el sistema MUST generar nuevo token y enviar email

### Requirement: CSRF Protection on Onboarding Endpoints
Onboarding endpoints MUST validar un header `x-csrf-token` o `x-request-id` para mitigar CSRF.

#### Scenario: Request sin header CSRF
- GIVEN un request a `/api/auth/onboarding/*` sin `x-request-id`
- WHEN el middleware CSRF procesa el request
- THEN el sistema MUST responder 400 Bad Request
