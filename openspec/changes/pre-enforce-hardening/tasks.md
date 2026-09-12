# Tasks — Pre-enforce hardening

Plan SDD/TDD pequeño y cerrado. Reglas: RED con fallo guardado → GREEN mínimo → REFACTOR; unitarios con prisma mockeado (contrato de mocks vigente) y DB real solo en `__integration__` (`DATABASE_URL_TEST=... pnpm test:integration`); tests con rutas explícitas; code review y commit por fase con stage selectivo.

## PE-01 — Residuos (copy neutro + alias admin)

- [x] **PE01-T1 — RED copy/alias.** Tests de los handlers/auth-service: mensajes devueltos sin voseo ("No tienes acceso a esta empresa", "Revisa tu correo…", "Crea al menos un plan primero", "Inténtalo…"), y `approveAdminMembership` rechaza `tenantRole: "admin"` con el error de rol inválido existente (acepta solo manager/economico/dependiente). Verificado el 2026-09-11; evidencia RED preservada en `evidence/PE-01-RED.txt` (7 fallos esperados antes de producción).
  `pnpm exec vitest run src/features/auth src/features/admin`
- [x] **PE01-T2 — GREEN.** Ajustar las cadenas en `src/features/auth/api/handlers.ts`, `auth-service.ts` (y componentes de onboarding que las dupliquen), y el array `validRoles`/`cargoMap` en `admin-global-queries.ts`. Completado el 2026-09-11; `pnpm exec vitest run src/features/auth src/features/admin` pasó 20 archivos/136 tests. Evidencia: `evidence/PE-01-GREEN.txt` (warnings preexistentes de `act(...)`, `layoutId` y sourcemap, sin fallos).
- Commit: `fix(auth): copy neutro y retiro del alias de rol admin en aprobaciones (PE-01)`

## PE-02 — Handlers de onboarding a prismaPlatform

- [x] **PE02-T1 — RED (unitarios, modo enforce).** Por handler (`register` con referralCode, `onboardingType`, `onboardingTenant`, `onboardingMe`): con `TENANT_ISOLATION_MODE='enforce'` y prisma mockeado, afirmar que NO se invoca el modelo scoped sobre el cliente scoped (spy) y SÍ sobre platform. Completado el 2026-09-12; evidencia RED preservada en `evidence/PE-02-RED.txt` (4 fallos esperados antes del cambio; el contrato AS-03 permaneció verde).
- [x] **PE02-T2 — GREEN.** Sustituir en `src/features/auth/api/handlers.ts` las queries a modelos SCOPED por `prismaPlatform` (incluida la transacción completa del flujo salesAgent en `onboardingType` — no partirla entre clientes). La allowlist AS-03 incorpora el import exacto de `src/features/auth/api/handlers.ts`; `auth-service.ts` no requiere cambio en PE-02. Completado el 2026-09-12; `pnpm exec vitest run src/features/auth src/lib/db` pasó 11 archivos/87 tests. Evidencia: `evidence/PE-02-GREEN.txt` (sin fallos).
  `pnpm exec vitest run src/features/auth src/lib/db`
- Commit: `fix(auth): onboarding usa prismaPlatform para membresías fuera de contexto (PE-02)`

## PE-03 — switchTenant multi-tenant

- [x] **PE03-T1 — RED.** Test que monta contexto del tenant A y llama `switchTenant` al tenant B (membresía válida): en `enforce` debe resolver con los tokens del tenant B; y el caso negativo (sin membresía) → FORBIDDEN. Mockear clientes y afirmar que el lookup de membresía se hace en platform (no recibe inyección del tenant origen). **Completado: 2026-09-12. Evidencia: `evidence/PE-03-RED.txt` (2 fallos auténticos antes de producción).**
  `pnpm exec vitest run src/features/auth`
- [x] **PE03-T2 — GREEN.** `switchTenant` valida la membresía con `prismaPlatform.tenantMembership.findUnique`; resto intacto (`resolveTenantContext`, emisión de tokens, reset de sesiones). **Completado: 2026-09-12. Evidencia: `evidence/PE-03-GREEN.txt` (89 tests en `src/features/auth src/lib/db`; 36 tests en `src/features/auth`; AS-03 verde).**
- Commit: `fix(auth): switchTenant valida membresía vía plataforma bajo enforce (PE-03)`

## PE-04 — Gate de integración en enforce + observabilidad

- [x] **PE04-T1 — Suite de integración.** `src/features/auth/__integration__/onboarding-enforce.test.ts` con DB real (fixtures que se autodestruyen): (a) register+referido, (b) ciclo worker completo hasta login, (c) ciclo company hasta login del manager, (d) switch A↔B. Todo con `TENANT_ISOLATION_MODE=enforce`. **Completado: 2026-09-12. Evidencia: `evidence/PE-04-RED.txt` (fallo auténtico del contrato de cleanup) y `evidence/PE-04-GREEN.txt` (gate enfocado 8/8, dos ejecuciones, 0 residuos; el script amplio arrastra fallas de schema ajenas).**
  `DATABASE_URL_TEST=... pnpm exec vitest run --config vitest.integration.config.mjs src/features/auth/__integration__/onboarding-enforce.test.ts`
- [x] **PE04-T2 — Shadow cero.** Los mismos cuatro flujos en modo `shadow` no emiten violaciones; cada collector devuelve `[]`. **Completado: 2026-09-12. Evidencia: `evidence/PE-04-GREEN.txt`.**
- [x] **PE04-T3 — Producción.** Verificar en Railway que `TENANT_ISOLATION_MODE=shadow` está activa (o fijarla si falta) y registrar la fecha desde la que cuenta la ventana de observación para el gate P-1 de AS-06. **Completado: 2026-09-12; ventana desde `2026-09-12T05:02:57.021Z` (UTC). Evidencia: `evidence/PE-04-RAILWAY.txt`.**
- Commit: `test(auth): gate de integración enforce para onboarding y switch (PE-04)`

## PE-05 — Cierre

- [ ] **PE05-T1 — Regresión.** Suite acotada en modo default (`off`):
  `pnpm exec vitest run src/features/auth src/features/admin src/lib/db`
  + `pnpm exec prisma validate`.
- [ ] **PE05-T2 — Desbloquear AS-06.** Anotar en `openspec/changes/aislamiento-sistemico-tenant/tasks.md` (sección AS-06): "Desbloqueada por pre-enforce-hardening (fecha; evidencias PE-04)".
- [ ] **PE05-T3 — Memorias + archivo.** Actualizar memoria `post-planes-audit-onboarding` (resuelto) y mover este change a `openspec/changes/archive/2026-09-XX-pre-enforce-hardening/`.
- Commit: `chore(openspec): archivar pre-enforce-hardening y desbloquear AS-06 (PE-05)`

## Estimación (referencial)

| Fase | Producción | Tests | Esfuerzo |
|---|---|---|---|
| PE-01 | ~20 | ~40 | 0.5 d |
| PE-02 | ~60 | ~120 | 0.5 d |
| PE-03 | ~15 | ~60 | 0.25 d |
| PE-04 | ~10 | ~220 | 1 d |
| PE-05 | — | — | 0.25 d |

Riesgo dominante: la integración con DB real de PE-04 (fixtures y limpieza). Mitigación: reutilizar el patrón de `src/lib/__integration__/` existente.
