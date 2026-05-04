# Design: Multi-Tenant Onboarding Hardening

## Architecture Decisions

### Decision: Middleware-level rate limiting con Map en memoria
**Choice**: Usar un Map con contadores por IP+endpoint con ventana de tiempo (sliding window) en un helper `src/lib/rate-limit.ts`.
**Rationale**: No requiere Redis ni infra extra. Suficiente para MVP. El Map se limpia periódicamente.
**Trade-off**: No persiste entre deploys/serverless cold starts, pero es aceptable para este caso.

### Decision: CSRF vía header `x-request-id` en onboarding
**Choice**: En vez de session-based CSRF, requerir que el frontend envíe `x-request-id` (generado por el browser via `crypto.randomUUID()`).
**Rationale**: Las APIs de onboarding son stateless (JWT bearer). Un header obligatorio mitiga CSRF básico sin complejidad de tokens sincronizados.

### Decision: Membresías pendientes usan isActive=false + nuevo endpoint PATCH
**Choice**: Reutilizar `TenantMembership.isActive: false` para estado pendiente y exponer PATCH `/api/admin/memberships/[membershipId]`.
**Rationale**: No requiere nuevo campo de estado. El admin endpoint decide approve/reject con acciones explícitas.

## Data Flow

```text
MANAGER APPROVAL FLOW:
Worker elige tenant → POST /api/auth/onboarding/tenant
  → crea TenantMembership(isActive: false, tenantRole: 'dependiente')
  → actualiza User.onboardingStatus = 'awaiting_manager_approval'
  → notifica a managers del tenant

Manager lista → GET /api/admin/memberships/pending
  → filtra por tenantId + isActive: false

Manager aprueba → PATCH /api/admin/memberships/:id { action: 'approve' }
  → memberships.isActive = true
  → User.isActive = true, User.role = 'dependiente'
  → notifica al worker

Manager rechaza → PATCH /api/admin/memberships/:id { action: 'reject' }
  → borra membership
  → User.onboardingStatus = 'selecting_tenant' (vuelve a elegir)
```

```text
LOGIN WITH ONBOARDING STATE:
login POST → verifica credenciales → bypass isActive check si onboardingStatus NO es 'completed' y NO es null
  → genera JWT sin tenantId/tenantRole
  → response incluye onboardingStatus para que frontend redirija
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/rate-limit.ts` | Create | Rate limiter con sliding window en memoria |
| `src/lib/auth/onboarding.ts` | Modify | Agregar `signResendVerificationToken` con propósito único |
| `src/app/api/auth/register/route.ts` | Modify | Rate limit + CSRF header check |
| `src/app/api/auth/verify-email/route.ts` | Modify | Rate limit + CSRF header check |
| `src/app/api/auth/onboarding/type/route.ts` | Modify | CSRF header check |
| `src/app/api/auth/onboarding/tenant/route.ts` | Modify | CSRF header check + notificar managers |
| `src/app/api/auth/onboarding/me/route.ts` | Modify | CSRF header check |
| `src/app/api/auth/onboarding/resend-verification/route.ts` | Create | Reenviar email de verificación |
| `src/app/api/auth/login/route.ts` | Modify | Bypass isActive para mid-onboarding users |
| `src/app/api/admin/memberships/pending/route.ts` | Create | GET pendientes del tenant |
| `src/app/api/admin/memberships/[id]/route.ts` | Create | PATCH approve/reject |

## Interfaces

```ts
interface MembershipAction {
  action: 'approve' | 'reject'
  tenantRole?: TenantRole // solo en approve, default 'dependiente'
}

interface LoginOnboardingResponse {
  token: string
  user: {
    userId: string
    email: string
    onboardingStatus: string | null
    isActive: boolean
    // tenantId y tenantRole solo si isActive + membership activa
  }
}
```

## Testing Strategy

| Layer | What to Test |
|-------|-------------|
| Unit | Rate limiter (ventanas, conteo, limpieza) |
| Unit | CSRF middleware (rechazo sin header) |
| Integration | Login con onboardingStatus mid-flow |
| Integration | Membership approval/rejection flow |
