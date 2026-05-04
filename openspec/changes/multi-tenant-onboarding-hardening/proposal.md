# Proposal: Multi-Tenant Onboarding Hardening

## Intent
Endurecer el flujo de onboarding multi-tenant: proteger endpoints públicos con rate limiting CSRF, agregar endpoints admin para aprobar/rechazar miembros pendientes, manejar estados de onboarding en login, y cerrar edge cases del flujo worker/company.

## Scope

### In Scope
- Rate limiting en endpoints públicos (/register, /verify-email, /onboarding/*)
- CSRF token header requerido en endpoints de onboarding
- Endpoint PATCH `/api/admin/memberships/[membershipId]` para aprobar/rechazar solicitudes
- Endpoint GET `/api/admin/memberships/pending` para listar pendientes
- Endpoint POST `/api/auth/onboarding/resend-verification` para reenviar email
- Manejo de estados onboarding en login (usuario mid-onboarding no bloqueado)
- Notificación al manager cuando un worker solicita acceso
- Test unitarios para onboarding endpoints

### Out of Scope
- UI administrativa para aprobar membresías (solo API)
- Flujo company (se mantiene `awaiting_global_approval` sin cambios)

## Capabilities
- **Modified**: `multi-tenant-platform` (endurece onboarding, membresías)

## Risks
| Risk | Mitigation |
|------|------------|
| Rate limiting muy agresivo bloquea usuarios legítimos | Configurable via env vars con defaults razonables |
| El login maneja usuario mid-onboarding con isActive=false | Verificar onboardingStatus antes de isActive check |

## Rollback
Los nuevos endpoints son aditivos. Las modificaciones a login son condicionales basadas en onboardingStatus. Rollback: revertir cambios en login y remover endpoints nuevos.
