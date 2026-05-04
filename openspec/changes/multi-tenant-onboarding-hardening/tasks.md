# Tasks: Multi-Tenant Onboarding Hardening

## Phase 1: Foundation
- [x] 1.1 Crear `src/lib/rate-limit.ts` con sliding window rate limiter en memoria
- [x] 1.2 Crear `src/lib/rate-limit.test.ts` con tests unitarios

## Phase 2: CSRF + Rate Limit en Endpoints Públicos
- [x] 2.1 Agregar rate limit + CSRF check a `/api/auth/register`
- [x] 2.2 Agregar rate limit + CSRF check a `/api/auth/verify-email`
- [x] 2.3 Agregar CSRF check a `/api/auth/onboarding/me`
- [x] 2.4 Agregar CSRF check a `/api/auth/onboarding/type`
- [x] 2.5 Agregar CSRF check a `/api/auth/onboarding/tenant`

## Phase 3: Manager Membership Approval Endpoints
- [x] 3.1 Crear GET `/api/admin/memberships/pending` para listar membresías pendientes
- [x] 3.2 Crear PATCH `/api/admin/memberships/[id]` con approve/reject
- [x] 3.3 Agregar notificación al manager cuando worker solicita acceso en `/api/auth/onboarding/tenant`

## Phase 4: Resend Verification
- [x] 4.1 Crear POST `/api/auth/onboarding/resend-verification`

## Phase 5: Login Onboarding States
- [x] 5.1 Modificar `/api/auth/login` para bypass isActive en estados de onboarding pendientes
- [x] 5.2 Devolver onboardingStatus en respuesta de login para redirección del frontend

## Phase 6: Tests
- [x] 6.1 Tests unitarios para rate limiter
- [x] 6.2 Tests de integración para login con onboarding mid-flow
- [x] 6.3 Tests de integración para flujo approve/reject memberships
