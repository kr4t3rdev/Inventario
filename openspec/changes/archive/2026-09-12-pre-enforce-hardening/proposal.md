# Pre-enforce hardening: desbloquear AS-06 sin romper onboarding ni multi-tenant

## Decisión ejecutiva

Antes de activar `TENANT_ISOLATION_MODE=enforce` (AS-06 del change `aislamiento-sistemico-tenant`), cerrar los **5 puntos del ciclo onboarding/identidad que hoy operan con el cliente scoped sin contexto de tenant válido**, más los residuos detectados en la re-auditoría 2026-09-07 (memoria `post-planes-audit-onboarding`). Es un change pequeño, de seguridad funcional: su objetivo no es endurecer más el aislamiento, sino **garantizar que el endurecimiento no rompa la entrada de usuarios al sistema**.

## Problema

La extensión de aislamiento (AS-02) exige contexto de tenant (ALS poblado por `authenticateUser`/`withAction`) para toda operación sobre modelos `SCOPED`. Pero hay flujos que por diseño **ocurren antes o fuera de un contexto tenant**:

1. **`register` con código de referido** (`src/features/auth/api/handlers.ts`): valida `affiliateProfile.findUnique` (SCOPED) en un endpoint público → en `enforce`: `TenantContextRequiredError`.
2. **`onboardingType`** (mismo archivo): `tenantMembership.count` y `tenantMembership.deleteMany` (SCOPED) bajo token de onboarding propio, sin ALS.
3. **`onboardingTenant`** (mismo archivo): `tenantMembership.upsert` (SCOPED) — aquí muere el flujo worker completo.
4. **`onboardingMe`** (mismo archivo): `tenantMembership.count`.
5. **`switchTenant`** (`src/features/auth/services/auth-service.ts`): corre DENTRO de `authenticateUser`, pero el ALS lleva el **tenant origen**; el lookup `tenantMembership.findUnique({ tenantId: destino })` recibe el filtro inyectado del origen → todo cambio de empresa falla con "No tenés acceso" para usuarios multi-tenant. Es la rotura más silenciosa porque **sí hay contexto, pero es el equivocado**.

Residuos (huérfanos) a cerrar en el mismo change:
- `approveAdminMembership` acepta `tenantRole: "admin"` (alias legado que luego se normaliza a manager) — retirarlo del enum de entrada.
- Textos con voseo en flujos de auth/onboarding ("No tenés acceso", "Revisá tu correo", "Creal al menos un plan", "Intentalo…") — violan la regla de español neutro (AGENTS.md) y son el primer texto que ve un usuario nuevo.
- Confirmación operativa del modo `shadow` en producción (Railway) para tener telemetría antes del gate de AS-06.

## Propuesta

Adoptar la regla: **toda operación sobre identidad/membresías que ocurre fuera o antes de un contexto tenant usa `prismaPlatform`** (auth/onboarding ya están en la allowlist del change de aislamiento; este change formaliza esa pertenencia) y **`switchTenant` valida la membresía contra plataforma** (la plataforma decide membresías; el tenant actual no).

1. **PE-01 — Residuos:** copy neutral y retiro del alias `admin` en la aprobación de membresía, con tests.
2. **PE-02 — Handlers de onboarding a plataforma:** `register` (rama referral), `onboardingType`, `onboardingTenant`, `onboardingMe`. Cada uno con tests RED en modo `enforce` que hoy fallan, y GREEN tras el cambio de cliente.
3. **PE-03 — `switchTenant`:** validación de membresía con `prismaPlatform`; test RED que reproduce la inyección del tenant origen y GREEN que prueba el cambio multi-tenant bajo `enforce`.
4. **PE-04 — Gate anti-regresión + observabilidad:** suite (integración) que corre los 4 flujos completos (register+referido, worker, company, switch) con `TENANT_ISOLATION_MODE=enforce`; verificación operativa de `shadow` en producción y revisión de las violaciones shadow acumuladas (deben quedar en cero en estos flujos).
5. **PE-05 — Cierre:** actualizar `tasks.md` de `aislamiento-sistemico-tenant` (AS-06 desbloqueada, dependencia registrada) y memorias.

## No-goals

- No se activa `enforce` (eso es AS-06, con su gate P-1).
- No se restructura el estado de onboarding (`onboardingStatus` machine) ni se cambia la UX.
- No se tocan `permisos-granulares` ni `correcciones-urgentes` (ya archivados); si aparece un conflicto real, se reporta y se resuelve en el punto, no se expande el alcance.
- No se audita de nuevo el resto del sistema: el alcance es la lista medida de la re-auditoría. Si el modo `enforce` en la suite de PE-04 revela infracciones adicionales, se registran como hallazgo y se valoran; no se corrigen por defecto dentro de este change.

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Handlers auth/onboarding | `src/features/auth/api/handlers.ts` (register, onboardingType, onboardingTenant, onboardingMe) | Sustituir uso de `prisma` scoped por `prismaPlatform` en las queries a modelos SCOPED fuera de contexto |
| Switch tenant | `src/features/auth/services/auth-service.ts` | Membership lookup vía `prismaPlatform` |
| Aprobación membresía | `src/features/admin/server/admin-global-queries.ts` | Quitar `"admin"` de roles válidos + mensaje |
| Copy auth | los anteriores + componentes onboarding si aplican | Español neutro (test de copy ya existe en el repo como referencia de patrón) |
| Tests | `src/features/auth/__tests__/` y `src/features/auth/__integration__/` (nueva) | Nuevo gate enforce |
| CI/docs | comando documentado; opcionalmente job en workflow existente | registrar en `ci.yml` o como script manual según costo |

## Criterios de aceptación

1. Con `TENANT_ISOLATION_MODE=enforce`, los flujos register+referido, worker completo (hasta membresía activa), company completo (hasta login del manager) y switch multi-tenant pasan de punta a punta.
2. En `shadow`, esos flujos dejan de generar violaciones.
3. Ningún comportamiento cambia en modo `off` (regresión de la suite actual verde).
4. Español neutro en todos los textos de auth/onboarding tocados; alias `admin` rechazado con mensaje claro.
5. `aislamiento-sistemico-tenant` queda con AS-06 marcada como desbloqueada por este change.
