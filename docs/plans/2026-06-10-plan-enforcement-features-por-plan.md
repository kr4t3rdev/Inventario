# Enforcement de Features por Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce tenant plan features in backend Server Actions using a shared `requireFeature(user, key)` helper so a tenant on the plan Basico only executes features enabled by its license.

**Architecture:** Keep enforcement server-first and minimal. Reuse the existing auth pipeline so `withAction()` continues injecting `AuthenticatedUser`, extend that user context with resolved plan features from the active `TenantLicense`, and centralize plan authorization in `src/lib/services/tenant-scope.ts`. Apply the helper only to Server Actions with a clear 1:1 feature mapping first, then stop at explicit risk gates before touching mixed modules.

**Tech Stack:** Next.js Server Actions, TypeScript, Prisma, Vitest, existing `withAction()` wrapper, Engram memory.

---

## Scope Rules

- Backend enforcement only in this first slice.
- No sidebar or page hiding in this plan.
- No API route enforcement in this plan.
- No automatic inference of feature keys from route names.
- Stop and ask on risk before touching mixed modules where one file serves both allowed and blocked plan features.

## Basico Plan Contract

The Basico plan disables at least these feature keys, which MUST be blocked in backend actions during this plan:

- `clientes`
- `facturacion`
- `series-facturacion`
- `listas-precios`
- `turnos-pos`
- `cuadre-diario`
- `ofertas`
- `multi-moneda`
- `reportes-financieros`
- `cuentas-cobrar`
- `cuentas-pagar`
- `prestamos-cash`
- `deudas-cash`
- `anticipos`
- `produccion`
- `reparaciones`
- `empleados`
- `nomina`
- `contratos`
- `notificaciones`

## Target Files

### Shared auth and guards

- Modify: `src/lib/auth-middleware.ts`
- Modify: `src/lib/server-actions/get-current-user.ts`
- Modify: `src/lib/services/tenant-scope.ts`
- Test: `src/lib/services/__tests__/tenant-scope.test.ts`

### Phase 1 action files with clear 1:1 feature mapping

- Modify: `src/features/clientes/actions.ts`
- Modify: `src/features/facturas/actions.ts`
- Modify: `src/features/series-facturacion/actions.ts`
- Modify: `src/features/listas-precios/actions.ts`
- Modify: `src/features/ofertas/actions.ts`
- Modify: `src/features/cuadre-diario/actions.ts`
- Modify: `src/features/turnos-pos/actions.ts`
- Modify: `src/features/empleados/actions.ts`
- Modify: `src/features/pago-salario/actions.ts`
- Modify: `src/features/produccion/actions.ts`
- Modify: `src/features/reparaciones/actions.ts`
- Modify: `src/features/contratos/actions.ts`
- Modify: `src/features/notificaciones/actions.ts`

### Phase 1 focused tests

- Modify: `src/features/clientes/__tests__/actions.test.ts`
- Modify: `src/features/facturas/__tests__/actions.test.ts`
- Modify: `src/features/series-facturacion/__tests__/actions.test.ts`
- Modify: `src/features/listas-precios/__tests__/actions.test.ts`
- Modify: `src/features/empleados/__tests__/actions.test.ts`
- Modify: `src/features/produccion/__tests__/actions.test.ts`

## Risk Gates

### Risk Gate 1: user context shape

Recommended path: add `planFeatures?: Record<string, boolean>` to `AuthenticatedUser` and resolve it once in `resolveTenantContext()` from the active license.

Why this is recommended:

- avoids one extra Prisma query per action
- keeps `requireFeature(user, key)` synchronous and cheap
- matches the current pattern where `planLimits` already travels on `user`

Ask on risk if someone wants the helper to query Prisma directly per action. That increases latency and duplicates auth lookups.

### Risk Gate 2: mixed modules

Do not touch these in the first batch without confirmation:

- `src/features/ventas/actions.ts` because it mixes `ventas-pos` allowed with invoice generation and `serieFacturacion` side effects that may imply `facturacion`
- `src/features/backups/actions.ts` because it is global admin tooling and does not represent tenant self-service backups cleanly
- `src/features/contabilidad/actions.ts` because the Basico plan includes `contabilidad` but not several advanced accounting subfeatures
- `src/features/reportes-financieros/actions.ts` because it also appears to have a tenant-scope concern, not only feature enforcement

### Risk Gate 3: latent bugs discovered while enforcing

If a target action is found to also lack tenant scoping or has behavioral coupling unrelated to plan access, stop and ask whether to:

- fix only the authorization hole now, or
- bundle the root-cause fix in the same slice

Default recommendation: isolate authorization first unless the bug makes the test impossible.

## Task 1: Extend authenticated tenant context with plan features

**Files:**

- Modify: `src/lib/auth-middleware.ts`
- Modify: `src/lib/server-actions/get-current-user.ts`

**Step 1: Write the failing type and behavior test mentally before code**

Expected outcome:

- `resolveTenantContext()` returns `planFeatures` from active `TenantLicense.features`
- `getCurrentUser()` forwards `planFeatures` into `AuthenticatedUser`

**Step 2: Add the new user shape**

Add to `AuthenticatedUser` in `src/lib/auth-middleware.ts`:

```ts
planFeatures?: Record<string, boolean>
```

Extend `resolveTenantContext()` return type and payload to include:

```ts
planFeatures: license?.features as Record<string, boolean> | undefined
```

Guardrails:

- treat missing or non-object `features` as `undefined`
- do not widen this change beyond tenant-auth context

**Step 3: Forward the field in `getCurrentUser()`**

Add `planFeatures: tenantContext.planFeatures` in the authenticated user object when tenant context exists.

**Step 4: Run targeted verification**

Run:

```bash
pnpm run typecheck
```

Expected: no new TypeScript errors from `AuthenticatedUser` changes.

**Step 5: Commit**

```bash
git add src/lib/auth-middleware.ts src/lib/server-actions/get-current-user.ts
git commit -m "feat: expose tenant plan features in auth context"
```

## Task 2: Implement `requireFeature(user, key)` in the existing tenant guard module

**Files:**

- Modify: `src/lib/services/tenant-scope.ts`
- Test: `src/lib/services/__tests__/tenant-scope.test.ts`

**Step 1: Write failing unit tests first**

Add tests covering:

- allows access when `planFeatures[key] === true`
- denies access when `planFeatures[key] === false`
- denies access when `planFeatures` is missing for tenant users
- throws `FORBIDDEN` via `ActionError`
- bypasses check for global admin users only if that is already accepted behavior in the codebase

Recommended error contract:

```ts
throw new ActionError(
  'Tu plan actual no incluye esta funcionalidad. Actualiza tu plan para continuar.',
  'FEATURE_NOT_AVAILABLE',
)
```

**Step 2: Implement the helper minimally**

Recommended shape:

```ts
export function requireFeature(
  user: AuthenticatedUser,
  featureKey: string,
  action: string = 'acceder a esta funcionalidad',
): void
```

Recommended behavior:

- if `user.role === 'admin'`, allow
- call `requireTenant(user)` to ensure tenant context exists
- if `user.planFeatures?.[featureKey] !== true`, throw `ActionError`

Do not add registry lookups or label translation in v1. Keep the helper dead simple.

**Step 3: Run focused tests**

Run:

```bash
pnpm run test:run -- src/lib/services/__tests__/tenant-scope.test.ts
```

Expected: PASS with new `requireFeature` coverage.

**Step 4: Commit**

```bash
git add src/lib/services/tenant-scope.ts src/lib/services/__tests__/tenant-scope.test.ts
git commit -m "feat: add plan feature guard for server actions"
```

## Task 3: Apply the guard to the clean 1:1 modules first

**Files:**

- Modify: `src/features/clientes/actions.ts`
- Modify: `src/features/facturas/actions.ts`
- Modify: `src/features/series-facturacion/actions.ts`
- Modify: `src/features/listas-precios/actions.ts`
- Modify: `src/features/ofertas/actions.ts`
- Modify: `src/features/cuadre-diario/actions.ts`
- Modify: `src/features/turnos-pos/actions.ts`
- Modify: `src/features/empleados/actions.ts`
- Modify: `src/features/pago-salario/actions.ts`
- Modify: `src/features/produccion/actions.ts`
- Modify: `src/features/reparaciones/actions.ts`
- Modify: `src/features/contratos/actions.ts`
- Modify: `src/features/notificaciones/actions.ts`

**Step 1: Add the import in each file**

Use the existing guard module import:

```ts
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
```

or merge with existing `requireManagerRole` imports where needed.

**Step 2: Add the guard at the top of every action**

Pattern:

```ts
requireFeature(user, 'clientes', 'gestionar clientes');
const tenantId = requireTenant(user);
```

Feature mapping for this batch:

- `src/features/clientes/actions.ts` -> `clientes`
- `src/features/facturas/actions.ts` -> `facturacion`
- `src/features/series-facturacion/actions.ts` -> `series-facturacion`
- `src/features/listas-precios/actions.ts` -> `listas-precios`
- `src/features/ofertas/actions.ts` -> `ofertas`
- `src/features/cuadre-diario/actions.ts` -> `cuadre-diario`
- `src/features/turnos-pos/actions.ts` -> `turnos-pos`
- `src/features/empleados/actions.ts` -> `empleados`
- `src/features/pago-salario/actions.ts` -> `nomina`
- `src/features/produccion/actions.ts` -> `produccion`
- `src/features/reparaciones/actions.ts` -> `reparaciones`
- `src/features/contratos/actions.ts` -> `contratos`
- `src/features/notificaciones/actions.ts` -> `notificaciones`

**Step 3: Keep order consistent**

Recommended order inside each action:

1. `requireFeature(...)`
2. `requireManagerRole(...)` if applicable
3. `requireTenant(user)`
4. parse schema
5. business logic

That order makes feature denial happen before tenant DB work.

**Step 4: Run typecheck before tests**

Run:

```bash
pnpm run typecheck
```

Expected: no import or `AuthenticatedUser` typing regressions.

**Step 5: Commit**

```bash
git add src/features/clientes/actions.ts src/features/facturas/actions.ts src/features/series-facturacion/actions.ts src/features/listas-precios/actions.ts src/features/ofertas/actions.ts src/features/cuadre-diario/actions.ts src/features/turnos-pos/actions.ts src/features/empleados/actions.ts src/features/pago-salario/actions.ts src/features/produccion/actions.ts src/features/reparaciones/actions.ts src/features/contratos/actions.ts src/features/notificaciones/actions.ts
git commit -m "feat: enforce plan features in server actions"
```

## Task 4: Add action-level tests for denial paths

**Files:**

- Modify: `src/features/clientes/__tests__/actions.test.ts`
- Modify: `src/features/facturas/__tests__/actions.test.ts`
- Modify: `src/features/series-facturacion/__tests__/actions.test.ts`
- Modify: `src/features/listas-precios/__tests__/actions.test.ts`
- Modify: `src/features/empleados/__tests__/actions.test.ts`
- Modify: `src/features/produccion/__tests__/actions.test.ts`

**Step 1: Add a reusable blocked-plan user fixture in each touched test file**

Pattern:

```ts
const blockedPlanUser: AuthenticatedUser = {
  ...mockUser,
  tenantRole: 'manager',
  planFeatures: { clientes: false },
};
```

**Step 2: Add one denial test per feature module**

Pattern:

```ts
it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye clientes', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    ...mockUser,
    planFeatures: { clientes: false },
  });

  const result = await getClientesAction();

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
});
```

Keep these tests small. One denial path per file is enough for phase 1.

**Step 3: Run focused tests**

Run:

```bash
pnpm run test:run -- src/features/clientes/__tests__/actions.test.ts src/features/facturas/__tests__/actions.test.ts src/features/series-facturacion/__tests__/actions.test.ts src/features/listas-precios/__tests__/actions.test.ts src/features/empleados/__tests__/actions.test.ts src/features/produccion/__tests__/actions.test.ts
```

Expected: PASS with `FEATURE_NOT_AVAILABLE` assertions.

**Step 4: Commit**

```bash
git add src/features/clientes/__tests__/actions.test.ts src/features/facturas/__tests__/actions.test.ts src/features/series-facturacion/__tests__/actions.test.ts src/features/listas-precios/__tests__/actions.test.ts src/features/empleados/__tests__/actions.test.ts src/features/produccion/__tests__/actions.test.ts
git commit -m "test: cover denied feature access by plan"
```

## Task 5: Verification pass for the first enforcement slice

**Files:**

- No new code files

**Step 1: Run the shared suite for touched backend slices**

Run:

```bash
pnpm run test:run -- src/lib/services/__tests__/tenant-scope.test.ts src/features/clientes/__tests__/actions.test.ts src/features/facturas/__tests__/actions.test.ts src/features/series-facturacion/__tests__/actions.test.ts src/features/listas-precios/__tests__/actions.test.ts src/features/empleados/__tests__/actions.test.ts src/features/produccion/__tests__/actions.test.ts
```

Expected: PASS.

**Step 2: Run quality gates**

Run:

```bash
pnpm run typecheck
pnpm run lint
```

Expected: PASS or only pre-existing unrelated failures documented before continuing.

**Step 3: Manual review checklist**

- every touched action calls `requireFeature()` before business logic
- global admin access still works
- users without tenant context still fail through existing auth/tenant guards
- no feature key typos compared with `src/features/planes/feature-registry.ts`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify first plan feature enforcement slice"
```

## Task 6: Interactive follow-up backlog after phase 1

Do not auto-implement these without asking.

### Follow-up A: mixed sales flow

Investigate `src/features/ventas/actions.ts` to separate:

- plain POS sales allowed by `ventas-pos`
- invoice or fiscal side effects requiring `facturacion`
- customer-linked flows requiring `clientes`
- turno auto-creation requiring `turnos-pos`

### Follow-up B: advanced accounting slices

Review these separately because Basico includes `contabilidad` but not all subfeatures:

- `src/features/contabilidad/actions-exchange.ts` -> `multi-moneda`
- `src/features/contabilidad/actions-prestamos-cash.ts` -> `prestamos-cash`
- `src/features/contabilidad/actions-deudas-cash.ts` -> `deudas-cash`
- `src/features/contabilidad/actions-anticipos.ts` -> `anticipos`
- shared accounting actions that may need more granular keys later

### Follow-up C: reporting and backups

Review separately because they are not pure feature toggles today:

- `src/features/reportes-financieros/actions.ts`
- `src/features/backups/actions.ts`

## Engram Notes

After each completed task, save a memory with:

- what changed
- why the enforcement slice was chosen
- which feature keys were covered
- any mixed-module risk discovered

Suggested topic keys:

- `architecture/plan-feature-enforcement`
- `bugfix/plan-access-control`
- `discovery/mixed-feature-modules`

## Completion Criteria

- Basico-blocked modules in phase 1 return `FEATURE_NOT_AVAILABLE`
- helper is centralized and reused
- no UI work was mixed into this slice
- verification commands were run and recorded
- mixed-module follow-ups remain explicit and gated

---

Plan complete and saved to `docs/plans/2026-06-10-plan-enforcement-features-por-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
