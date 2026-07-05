# Plan entitlements source of truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los permisos efectivos del tenant salgan de `Plan.features` más overrides por licencia, eliminando la necesidad de backfills recurrentes cada vez que cambian los planes.

**Architecture:** Se agrega un campo explícito de overrides en `TenantLicense`, se centraliza la resolución de permisos en un helper puro y `resolveTenantContext()` deja de tratar `TenantLicense.features` como snapshot canónico. La migración se hace en dos fases: compatibilidad retroactiva primero, conversión de snapshots legacy a overrides después.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Vitest, Zod.

---

## File Structure

**Create**
- `src/lib/plan-features.ts` — resolver puro de features efectivos (`plan.features + overrides`) y utilidades de compatibilidad legacy.
- `src/lib/__tests__/plan-features.test.ts` — tests unitarios del resolver de entitlements.
- `prisma/migrations/<timestamp>_add_feature_overrides_to_tenant_license/migration.sql` — agrega `featureOverrides` a `TenantLicense`.
- `prisma/seed/backfill-license-feature-overrides.ts` — migra snapshots legacy a overrides mínimos.
- `prisma/seed/__tests__/backfill-license-feature-overrides.test.ts` — tests del cálculo de overrides legacy.
- `docs/superpowers/plans/2026-07-03-plan-entitlements-source-of-truth.md` — este plan.

**Modify**
- `prisma/schema.prisma` — modelo `TenantLicense` con `featureOverrides Json?`.
- `src/lib/auth-middleware.ts` — usa resolver efectivo en `resolveTenantContext()`.
- `src/lib/server-actions/get-current-user.ts` — valida el contrato actualizado sin cambios de comportamiento externo.
- `src/lib/services/tenant-factory.ts` — crea licencias nuevas con `featureOverrides: {}` y deja de snapshotear `plan.features` en `features`.
- `src/lib/services/demo-tenant-factory.ts` — mismo ajuste para demos.
- `src/features/admin/actions.ts` — create/update/convert licencia deben escribir overrides y no snapshots completos.
- `src/features/admin/schemas.ts` — schema explícito para overrides si la UI admin los edita.
- `src/features/planes/actions.ts` — sin cambio funcional fuerte, pero puede necesitar helper compartido para lectura consistente.
- `src/lib/__tests__/auth-middleware.test.ts` — cubrir merge de plan + overrides + fallback legacy.
- `src/lib/server-actions/__tests__/get-current-user.test.ts` — cubrir que el usuario autenticado recibe features efectivos.
- `src/lib/services/__tests__/demo-tenant-factory.test.ts` — validar licencias nuevas con overrides vacíos.
- `src/features/admin/__tests__/actions.test.ts` — validar conversión demo→paid y updates admin con `featureOverrides`.

---

### Task 1: Introducir el resolver de entitlements con compatibilidad legacy

**Files:**
- Create: `src/lib/plan-features.ts`
- Test: `src/lib/__tests__/plan-features.test.ts`

- [ ] **Step 1: Write the failing tests for effective feature resolution**

```ts
import { describe, expect, it } from 'vitest';

import {
  diffPlanFeaturesToOverrides,
  resolveEffectivePlanFeatures,
} from '@/lib/plan-features';

describe('resolveEffectivePlanFeatures', () => {
  it('merges plan features with explicit license overrides', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
        featureOverrides: { 'reportes-financieros': false },
      }),
    ).toEqual({ contabilidad: true, 'reportes-financieros': false });
  });

  it('falls back to legacy snapshot when overrides are absent', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true },
        legacyLicenseFeatures: { contabilidad: false, clientes: true },
      }),
    ).toEqual({ contabilidad: false, clientes: true });
  });
});

describe('diffPlanFeaturesToOverrides', () => {
  it('stores only differences against the plan', () => {
    expect(
      diffPlanFeaturesToOverrides({
        planFeatures: { contabilidad: true, clientes: false },
        legacyLicenseFeatures: { contabilidad: true, clientes: true },
      }),
    ).toEqual({ clientes: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/__tests__/plan-features.test.ts`
Expected: FAIL with `Cannot find module '@/lib/plan-features'`.

- [ ] **Step 3: Write the minimal resolver implementation**

```ts
export interface ResolveEffectivePlanFeaturesInput {
  planFeatures?: Record<string, boolean> | null;
  featureOverrides?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}

export function resolveEffectivePlanFeatures(
  input: ResolveEffectivePlanFeaturesInput,
): Record<string, boolean> {
  const planFeatures = input.planFeatures ?? {};
  const featureOverrides = input.featureOverrides ?? null;
  const legacyLicenseFeatures = input.legacyLicenseFeatures ?? null;

  if (featureOverrides && Object.keys(featureOverrides).length > 0) {
    return { ...planFeatures, ...featureOverrides };
  }

  if (legacyLicenseFeatures && Object.keys(legacyLicenseFeatures).length > 0) {
    return { ...legacyLicenseFeatures };
  }

  return { ...planFeatures };
}

export function diffPlanFeaturesToOverrides(input: {
  planFeatures?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}): Record<string, boolean> {
  const planFeatures = input.planFeatures ?? {};
  const legacyLicenseFeatures = input.legacyLicenseFeatures ?? {};

  return Object.fromEntries(
    Object.entries(legacyLicenseFeatures).filter(
      ([key, value]) => planFeatures[key] !== value,
    ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/lib/__tests__/plan-features.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan-features.ts src/lib/__tests__/plan-features.test.ts
git commit -m "refactor: add effective plan feature resolver"
```

---

### Task 2: Cambiar auth para usar `Plan.features + featureOverrides`

**Files:**
- Modify: `src/lib/auth-middleware.ts`
- Modify: `src/lib/server-actions/get-current-user.ts`
- Test: `src/lib/__tests__/auth-middleware.test.ts`
- Test: `src/lib/server-actions/__tests__/get-current-user.test.ts`

- [ ] **Step 1: Write failing auth tests for merged entitlements**

```ts
it('returns merged plan features when featureOverrides exists', async () => {
  vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
    tenantId: 'tenant-1',
    activa: true,
    expiracion: new Date(Date.now() + 86400000),
    maxUsuarios: 5,
    maxAlmacenes: 1,
    maxProductos: 100,
    maxClientes: 50,
    features: { contabilidad: false },
    featureOverrides: { 'reportes-financieros': false },
    plan: { nombre: 'Básico', features: { contabilidad: true, 'reportes-financieros': true } },
  } as never);

  const result = await resolveTenantContext('user-1', 'tenant-1');

  expect(result?.planFeatures).toEqual({
    contabilidad: true,
    'reportes-financieros': false,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/__tests__/auth-middleware.test.ts src/lib/server-actions/__tests__/get-current-user.test.ts`
Expected: FAIL because `plan.features` / `featureOverrides` are not read yet.

- [ ] **Step 3: Implement the auth merge**

```ts
include: {
  plan: {
    select: {
      nombre: true,
      features: true,
    },
  },
},
```

```ts
import { resolveEffectivePlanFeatures } from '@/lib/plan-features';

const planFeatures = resolveEffectivePlanFeatures({
  planFeatures: license?.plan?.features as Record<string, boolean> | undefined,
  featureOverrides: license?.featureOverrides as Record<string, boolean> | undefined,
  legacyLicenseFeatures: license?.features as Record<string, boolean> | undefined,
});
```

- [ ] **Step 4: Run the auth tests**

Run: `CI=1 pnpm exec vitest run src/lib/__tests__/auth-middleware.test.ts src/lib/server-actions/__tests__/get-current-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-middleware.ts src/lib/server-actions/get-current-user.ts src/lib/__tests__/auth-middleware.test.ts src/lib/server-actions/__tests__/get-current-user.test.ts
git commit -m "refactor: resolve tenant features from plan and overrides"
```

---

### Task 3: Cambiar creación y actualización de licencias para dejar de snapshotear features

**Files:**
- Modify: `src/lib/services/tenant-factory.ts`
- Modify: `src/lib/services/demo-tenant-factory.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/schemas.ts`
- Test: `src/lib/services/__tests__/demo-tenant-factory.test.ts`
- Test: `src/features/admin/__tests__/actions.test.ts`

- [ ] **Step 1: Write failing tests for new license writes**

```ts
expect(__tx.tenantLicense.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
    featureOverrides: {},
    features: null,
  }),
});
```

```ts
expect(prisma.tenantLicense.update).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      planId: plan.planId,
      featureOverrides: {},
      features: null,
    }),
  }),
);
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `CI=1 pnpm exec vitest run src/lib/services/__tests__/demo-tenant-factory.test.ts src/features/admin/__tests__/actions.test.ts`
Expected: FAIL because factories/actions still copy `plan.features` into `TenantLicense.features`.

- [ ] **Step 3: Implement write-path changes**

```ts
features: Prisma.JsonNull,
featureOverrides: {} as Prisma.InputJsonValue,
```

```ts
const featureOverrides = parsed.featureOverrides ?? {};
```

```ts
data: {
  planId: plan.planId,
  features: Prisma.JsonNull,
  featureOverrides: {} as Prisma.InputJsonValue,
}
```

- [ ] **Step 4: Run tests to verify the write-path passes**

Run: `CI=1 pnpm exec vitest run src/lib/services/__tests__/demo-tenant-factory.test.ts src/features/admin/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/tenant-factory.ts src/lib/services/demo-tenant-factory.ts src/features/admin/actions.ts src/features/admin/schemas.ts src/lib/services/__tests__/demo-tenant-factory.test.ts src/features/admin/__tests__/actions.test.ts
git commit -m "refactor: stop snapshotting plan features in licenses"
```

---

### Task 4: Agregar soporte de esquema y migración de overrides

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_feature_overrides_to_tenant_license/migration.sql`
- Test: `src/lib/__tests__/auth-middleware.test.ts`

- [ ] **Step 1: Add the Prisma field definition**

```prisma
model TenantLicense {
  tenantLicenseId  String  @id @default(cuid())
  // ...existing fields...
  features         Json?
  featureOverrides Json?
}
```

- [ ] **Step 2: Create the SQL migration**

```sql
ALTER TABLE "tenant_licenses"
ADD COLUMN "featureOverrides" JSONB;
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm prisma generate`
Expected: Prisma client regenerated without schema errors.

- [ ] **Step 4: Run auth tests again against the new schema**

Run: `CI=1 pnpm exec vitest run src/lib/__tests__/auth-middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma src/lib/__tests__/auth-middleware.test.ts
git commit -m "feat: add license feature overrides field"
```

---

### Task 5: Convert existing snapshots to overrides with a one-time migration script

**Files:**
- Create: `prisma/seed/backfill-license-feature-overrides.ts`
- Create: `prisma/seed/__tests__/backfill-license-feature-overrides.test.ts`
- Modify: `prisma/seed/backfill-accounting-features.ts`

- [ ] **Step 1: Write failing tests for legacy snapshot conversion**

```ts
import { describe, expect, it } from 'vitest';

import { buildLicenseOverrideBackfill } from '../backfill-license-feature-overrides';

it('converts legacy snapshot deltas into minimal overrides', () => {
  expect(
    buildLicenseOverrideBackfill({
      planFeatures: { contabilidad: true, clientes: false },
      legacyLicenseFeatures: { contabilidad: true, clientes: true },
    }),
  ).toEqual({
    features: null,
    featureOverrides: { clientes: true },
  });
});
```

- [ ] **Step 2: Run the backfill tests to verify they fail**

Run: `CI=1 pnpm exec vitest run prisma/seed/__tests__/backfill-license-feature-overrides.test.ts`
Expected: FAIL because script/helpers do not exist.

- [ ] **Step 3: Implement the one-time migration script**

```ts
export function buildLicenseOverrideBackfill(input: {
  planFeatures?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}) {
  return {
    features: Prisma.JsonNull,
    featureOverrides: diffPlanFeaturesToOverrides(input) as Prisma.InputJsonValue,
  };
}
```

```ts
const licenses = await prisma.tenantLicense.findMany({
  include: {
    plan: { select: { features: true, nombre: true } },
  },
});
```

```ts
await prisma.tenantLicense.update({
  where: { tenantLicenseId: license.tenantLicenseId },
  data: buildLicenseOverrideBackfill({
    planFeatures: license.plan?.features as Record<string, boolean> | undefined,
    legacyLicenseFeatures: license.features as Record<string, boolean> | undefined,
  }),
});
```

- [ ] **Step 4: Run the backfill tests**

Run: `CI=1 pnpm exec vitest run prisma/seed/__tests__/backfill-license-feature-overrides.test.ts prisma/seed/__tests__/backfill-accounting-features.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed/backfill-license-feature-overrides.ts prisma/seed/__tests__/backfill-license-feature-overrides.test.ts prisma/seed/backfill-accounting-features.ts
git commit -m "feat: add one-time license override backfill"
```

---

### Task 6: Verificación final y rollout seguro

**Files:**
- Modify: `docs/superpowers/plans/2026-07-03-plan-entitlements-source-of-truth.md`
- Review: `src/lib/auth-middleware.ts`
- Review: `src/features/admin/actions.ts`
- Review: `prisma/seed/backfill-license-feature-overrides.ts`

- [ ] **Step 1: Run the focused regression suite**

Run:
```bash
CI=1 pnpm exec vitest run \
  src/lib/__tests__/plan-features.test.ts \
  src/lib/__tests__/auth-middleware.test.ts \
  src/lib/server-actions/__tests__/get-current-user.test.ts \
  src/lib/services/__tests__/demo-tenant-factory.test.ts \
  src/features/admin/__tests__/actions.test.ts \
  prisma/seed/__tests__/backfill-license-feature-overrides.test.ts \
  prisma/seed/__tests__/backfill-accounting-features.test.ts
```
Expected: PASS.

- [ ] **Step 2: Run lint on all touched files**

Run:
```bash
pnpm exec eslint \
  src/lib/plan-features.ts \
  src/lib/auth-middleware.ts \
  src/lib/server-actions/get-current-user.ts \
  src/lib/services/tenant-factory.ts \
  src/lib/services/demo-tenant-factory.ts \
  src/features/admin/actions.ts \
  src/features/admin/schemas.ts \
  prisma/seed/backfill-license-feature-overrides.ts
```
Expected: no errors.

- [ ] **Step 3: Rollout sequence**

```bash
pnpm prisma migrate deploy
pnpm tsx prisma/seed/backfill-license-feature-overrides.ts
pnpm tsx prisma/seed/backfill-accounting-features.ts
```
Expected: migration OK, licenses converted, accounting presets aligned.

- [ ] **Step 4: Smoke check in production**

```text
1. Login with tenant Básico.
2. Confirmar que /busy/reportes entra.
3. Confirmar que /busy/contabilidad/logs entra.
4. Confirmar que /busy/contabilidad/transferencias redirige/bloquea.
5. Confirmar que un tenant Profesional sí entra a transferencias y ajustes.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-03-plan-entitlements-source-of-truth.md
git commit -m "docs: add entitlements source-of-truth rollout plan"
```

---

## Self-Review

- **Spec coverage:** cubre source of truth, compatibilidad legacy, cambio de auth, write paths nuevos, migración Prisma y backfill one-shot.
- **Placeholder scan:** no dejé `TODO/TBD`; cada task tiene archivos, tests y comandos.
- **Type consistency:** el contrato usa `plan.features`, `featureOverrides` y `legacyLicenseFeatures` de forma consistente en todo el plan.
