# Administración Operativa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the hidden admin operational health matrices into a publishable admin surface with discoverable navigation, explicit server-side authorization, trustworthy metrics, and regression coverage.

**Architecture:** Keep the existing route-per-matrix structure under `src/app/admin/operaciones/*` and the shared query layer in `src/features/admin/server/operaciones.ts`. The remediation should harden the current implementation instead of redesigning it: expose the space in the admin sidebar, centralize admin-only guards in the server actions layer, replace placeholder metrics with real aggregates, and add focused tests around the shared server layer plus navigation wiring.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma, Vitest.

---

## File Map

- **Modify:** `src/components/admin-sidebar.tsx` — expose the Administración Operativa entry and child routes in the real admin navigation.
- **Modify:** `src/features/admin/server/operaciones.ts` — add explicit global-admin authorization and replace placeholder metrics with real aggregates.
- **Create:** `src/features/admin/server/operaciones.test.ts` — focused unit/integration-style tests for operational matrix actions with Prisma mocks.
- **Create:** `src/components/__tests__/admin-sidebar.test.tsx` — regression test proving the admin sidebar exposes the operational section.
- **Optional modify:** `src/app/admin/page.tsx` — only if we decide to add a dashboard CTA card linking to `/admin/operaciones/maestros`.
- **Optional create:** `src/app/admin/operaciones/page.tsx` — only if we want an index page instead of deep-linking directly to `maestros`.

## Task 1: Expose the space in admin navigation

**Files:**
- Modify: `src/components/admin-sidebar.tsx`
- Test: `src/components/__tests__/admin-sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar test**

Create `src/components/__tests__/admin-sidebar.test.tsx` with a focused render that asserts the admin nav contains the operational section and at least the first route:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminSidebar } from '@/components/admin-sidebar';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { role: 'admin', name: 'Admin' } }),
}));

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => true,
}));

vi.mock('@/components/ui/sidebar', async () => {
  const actual = await vi.importActual<object>('@/components/ui/sidebar');
  return {
    ...actual,
    useSidebar: () => ({ state: 'expanded' }),
  };
});

describe('AdminSidebar', () => {
  it('shows the Administración Operativa section with matrices routes', () => {
    render(<AdminSidebar />);

    expect(screen.getByText('Administración Operativa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Datos Maestros/i })).toHaveAttribute(
      'href',
      '/admin/operaciones/maestros',
    );
  });
});
```

- [ ] **Step 2: Run the sidebar test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/components/__tests__/admin-sidebar.test.tsx`
Expected: FAIL because the sidebar does not yet expose `Administración Operativa`.

- [ ] **Step 3: Add the operational group to the real sidebar**

Update the `data.groups` structure in `src/components/admin-sidebar.tsx` by inserting a new group between `Monitor` and `Licencias`:

```tsx
{
  title: 'Administración Operativa',
  items: [
    { title: 'Datos Maestros', url: '/admin/operaciones/maestros', icon: BarChart3 },
    { title: 'Ventas', url: '/admin/operaciones/ventas', icon: Activity },
    { title: 'Compras', url: '/admin/operaciones/compras', icon: Wallet },
    { title: 'Mermas', url: '/admin/operaciones/mermas', icon: AlertTriangle },
    { title: 'Facturación', url: '/admin/operaciones/facturacion', icon: FileText },
    { title: 'Ofertas y Servicios', url: '/admin/operaciones/ofertas-servicios', icon: Globe },
    { title: 'Gastos', url: '/admin/operaciones/gastos', icon: DollarSign },
  ],
}
```

Also extend `groupToneByTitle`:

```tsx
'Administración Operativa': 'from-rose-500/15 via-sidebar-accent/45 to-transparent',
```

- [ ] **Step 4: Run the sidebar test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/components/__tests__/admin-sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the navigation slice**

```bash
git add src/components/admin-sidebar.tsx src/components/__tests__/admin-sidebar.test.tsx
git commit -m "feat(admin): expose operational matrices in sidebar"
```

## Task 2: Enforce explicit global-admin authorization in server actions

**Files:**
- Modify: `src/features/admin/server/operaciones.ts`
- Test: `src/features/admin/server/operaciones.test.ts`

- [ ] **Step 1: Write the failing authorization test**

Create `src/features/admin/server/operaciones.test.ts` with a non-admin case:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getGlobalMastersHealthAction } from '@/features/admin/server/operaciones';

vi.mock('@/lib/server-actions', () => ({
  withAction: (fn: (input: unknown, user: unknown) => Promise<unknown>) =>
    (input: unknown, userOverride?: unknown) => fn(input, userOverride as never),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
  },
}));

describe('operaciones authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin users from global operational matrices', async () => {
    await expect(
      getGlobalMastersHealthAction(undefined as never, { role: 'manager' } as never),
    ).rejects.toThrow(/admin/i);
  });
});
```

- [ ] **Step 2: Run the authorization test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts -t "rejects non-admin users"`
Expected: FAIL because the action currently lacks an explicit admin guard.

- [ ] **Step 3: Add a shared admin guard inside `operaciones.ts`**

At the top of `src/features/admin/server/operaciones.ts`, add:

```ts
import { ActionError, withAction } from '@/lib/server-actions';

function requireGlobalAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ActionError(
      'Solo el administrador global puede acceder a la Administración Operativa.',
      'FORBIDDEN',
    );
  }
}
```

Then call it at the start of every exported action:

```ts
export const getGlobalMastersHealthAction = withAction(async (_, user: AuthenticatedUser) => {
  requireGlobalAdmin(user);
  // existing query...
});
```

Apply the same line to:
- `getGlobalSalesHealthAction`
- `getGlobalPurchaseHealthAction`
- `getGlobalWastageHealthAction`
- `getGlobalBillingHealthAction`
- `getGlobalOffersServicesHealthAction`
- `getGlobalExpenseHealthAction`
- `getTenantFeatureDataAction`

- [ ] **Step 4: Run the authorization test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts -t "rejects non-admin users"`
Expected: PASS.

- [ ] **Step 5: Commit the authorization slice**

```bash
git add src/features/admin/server/operaciones.ts src/features/admin/server/operaciones.test.ts
git commit -m "fix(admin): require global admin for operational matrices"
```

## Task 3: Replace placeholder metrics with real aggregates

**Files:**
- Modify: `src/features/admin/server/operaciones.ts`
- Test: `src/features/admin/server/operaciones.test.ts`

- [ ] **Step 1: Write the failing metrics tests**

Extend `src/features/admin/server/operaciones.test.ts` with two focused assertions:

```ts
it('calculates wastage total value from tenant wastage rows', async () => {
  prisma.tenant.findMany.mockResolvedValue([
    {
      tenantId: 't1',
      nombre: 'Tenant 1',
      slug: 'tenant-1',
      _count: { mermas: 2 },
      licencias: [{ plan: { nombre: 'Pro' } }],
    },
  ]);
  prisma.merma.aggregate.mockResolvedValue({ _sum: { totalCost: 1250 } });

  const result = await getGlobalWastageHealthAction(undefined as never, { role: 'admin' } as never);

  expect(result.wastageHealth[0].metrics.mermasTotalValue).toBe(1250);
});

it('calculates expense total amount instead of returning zero placeholder', async () => {
  prisma.tenant.findMany.mockResolvedValue([
    {
      tenantId: 't1',
      nombre: 'Tenant 1',
      slug: 'tenant-1',
      _count: { gastosDE: 3 },
      licencias: [{ plan: { nombre: 'Pro' } }],
    },
  ]);
  prisma.gastosDE.aggregate.mockResolvedValue({ _sum: { monto: 780 } });

  const result = await getGlobalExpenseHealthAction(undefined as never, { role: 'admin' } as never);

  expect(result.expenseHealth[0].metrics.gastosTotal).toBe(780);
});
```

- [ ] **Step 2: Run the metrics tests to verify they fail**

Run: `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts -t "calculates"`
Expected: FAIL because both totals currently return `0` placeholders.

- [ ] **Step 3: Implement real Prisma aggregates**

Update `src/features/admin/server/operaciones.ts`:

```ts
const aggregate = await prisma.merma.aggregate({
  where: { tenantId: t.tenantId },
  _sum: { totalCost: true },
});

metrics: {
  mermasCount: t._count.mermas,
  mermasTotalValue: Number(aggregate._sum.totalCost || 0),
}
```

And for expenses:

```ts
const aggregate = await prisma.gastosDE.aggregate({
  where: { tenantId: t.tenantId },
  _sum: { monto: true },
});

metrics: {
  gastosCount: t._count.gastosDE,
  gastosTotal: Number(aggregate._sum.monto || 0),
}
```

If the exact Prisma field names differ from `totalCost` or `monto`, stop and correct the test plus implementation against the actual schema before proceeding. No fake totals allowed.

- [ ] **Step 4: Run the metrics tests to verify they pass**

Run: `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts -t "calculates"`
Expected: PASS with real non-placeholder totals.

- [ ] **Step 5: Commit the metrics slice**

```bash
git add src/features/admin/server/operaciones.ts src/features/admin/server/operaciones.test.ts
git commit -m "fix(admin): calculate real operational matrix totals"
```

## Task 4: Lock shared behavior with focused regression coverage

**Files:**
- Modify: `src/features/admin/server/operaciones.test.ts`

- [ ] **Step 1: Add a masters mapping test**

Append:

```ts
it('maps tenant master counts and latest plan name correctly', async () => {
  prisma.tenant.findMany.mockResolvedValue([
    {
      tenantId: 't1',
      nombre: 'Clinica Norte',
      slug: 'clinica-norte',
      _count: {
        productos: 12,
        categorias: 4,
        unidades: 3,
        vendors: 2,
        puntosDeVenta: 1,
        listasPrecio: 2,
      },
      licencias: [{ plan: { nombre: 'Enterprise' } }],
    },
  ]);

  const result = await getGlobalMastersHealthAction(undefined as never, { role: 'admin' } as never);

  expect(result.healthData).toEqual([
    expect.objectContaining({
      tenantId: 't1',
      planName: 'Enterprise',
      counts: expect.objectContaining({ productos: 12, categorias: 4 }),
    }),
  ]);
});
```

- [ ] **Step 2: Add a drill-down query test**

Append:

```ts
it('loads tenant feature detail for categorias scoped by tenantId', async () => {
  prisma.categoria.findMany.mockResolvedValue([{ nombre: 'Medicamentos' }]);

  const result = await getTenantFeatureDataAction(
    { tenantId: 'tenant-1', feature: 'categorias' } as never,
    { role: 'admin' } as never,
  );

  expect(prisma.categoria.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
  );
  expect(result.data).toEqual([{ nombre: 'Medicamentos' }]);
});
```

- [ ] **Step 3: Run the full operaciones test file**

Run: `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the sidebar test again as a safety net**

Run: `CI=1 pnpm exec vitest run src/components/__tests__/admin-sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit the regression slice**

```bash
git add src/features/admin/server/operaciones.test.ts
git commit -m "test(admin): cover operational matrix regressions"
```

## Task 5: Optional product polish if the team wants stronger discoverability

**Files:**
- Optional modify: `src/app/admin/page.tsx`
- Optional create: `src/app/admin/operaciones/page.tsx`

- [ ] **Step 1: Decide the entry strategy**

Choose one and record it before editing code:

```md
Option A: sidebar-only discovery, cheapest path.
Option B: add dashboard CTA card to /admin.
Option C: create /admin/operaciones landing page and point sidebar there.
```

- [ ] **Step 2: If choosing dashboard CTA, add a compact card**

Example card content for `src/app/admin/page.tsx`:

```tsx
{
  title: 'Administración Operativa',
  description: 'Matrices globales de salud para maestros, ventas, compras, mermas, facturación, ofertas y gastos.',
  href: '/admin/operaciones/maestros',
}
```

- [ ] **Step 3: If choosing landing page, create a route index**

Create `src/app/admin/operaciones/page.tsx` with a cards grid linking to all seven matrices.

- [ ] **Step 4: Run the relevant page test or manual smoke check**

Run: `pnpm run dev`
Then manually verify `/admin`, `/admin/operaciones`, and `/admin/operaciones/maestros`.
Expected: links visible and navigation works.

- [ ] **Step 5: Commit the polish slice**

```bash
git add src/app/admin/page.tsx src/app/admin/operaciones/page.tsx
git commit -m "feat(admin): improve operational matrix discoverability"
```

## Verification Checklist

- `CI=1 pnpm exec vitest run src/components/__tests__/admin-sidebar.test.tsx`
- `CI=1 pnpm exec vitest run src/features/admin/server/operaciones.test.ts`
- Manual smoke: `/admin/operaciones/maestros`
- Manual smoke: one secondary matrix route (`/admin/operaciones/ventas` or `/admin/operaciones/gastos`)
- Confirm non-admin access is rejected at the action layer, not just hidden in UI.

## Spec Coverage Self-Review

- **Discoverability gap:** covered by Task 1 and optional Task 5.
- **Authorization gap:** covered by Task 2.
- **Placeholder metrics gap:** covered by Task 3.
- **Regression gap:** covered by Task 4.
- **No placeholder plan language remains** except the explicit optional product decision in Task 5, which is intentionally framed as a real fork.

Plan complete and saved to `docs/superpowers/plans/2026-07-06-admin-operaciones-publicacion.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
