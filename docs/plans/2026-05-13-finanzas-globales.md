# Finanzas Globales Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reconfigurar `/admin/finanzas` como un panel ejecutivo global con filtros, tendencia temporal y desglose financiero real, usando `/api/admin/finance` como fuente única de verdad.

**Architecture:** La página admin de finanzas dejará de depender de server actions directas y consumirá un contrato REST estable. La API aceptará filtros opcionales (`from`, `to`, `tenantId`, `groupBy`) y devolverá un payload consolidado para KPIs, series temporales y breakdowns. La UI se organizará en filtros, tarjetas KPI, gráfico de tendencia y paneles de detalle, manteniendo el resumen simple en `/admin`.

**Tech Stack:** Next.js 15, TypeScript, Prisma, React, Tailwind CSS, shadcn/ui, Vitest.

---

### Task 1: Alinear la fuente de verdad del panel

**Files:**
- Modify: `src/app/admin/finanzas/page.tsx`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/api/handlers.ts`
- Modify: `src/app/api/admin/finance/route.ts`

**Step 1: Write the failing test**

Crear o ajustar un test de API para validar que `GET /api/admin/finance` responde con el contrato base actual y que la página ya no depende de server action directo para obtener datos.

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/api/admin/finance/__tests__/route.test.ts -t "finance"`

Expected: FAIL because the route contract or invocation path is not yet aligned.

**Step 3: Write minimal implementation**

- Hacer que `/admin/finanzas` consuma `GET /api/admin/finance`.
- Mantener por ahora el payload actual para no cambiar la UI en esta fase.
- Dejar server action y handler como compatibilidad interna o removerlos solo si ya no se usan.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/api/admin/finance/__tests__/route.test.ts -t "finance"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/admin/finanzas/page.tsx src/features/admin/actions.ts src/features/admin/api/handlers.ts src/app/api/admin/finance/route.ts
git commit -m "refactor: unify global finance source of truth"
```

### Task 2: Expand the finance contract with filters and summary breakdowns

**Files:**
- Modify: `src/app/api/admin/finance/route.ts`
- Modify: `src/features/admin/api/handlers.ts`
- Modify: `src/features/admin/actions.ts`
- Test: `src/app/api/admin/finance/__tests__/route.test.ts`

**Step 1: Write the failing test**

Add cases for `from`, `to`, `tenantId`, and `groupBy`, plus the expected response shape:

```ts
{
  meta: { from, to, tenantId, groupBy },
  summary: { ingresosTotales, gastosTotales, resultadoNeto, tenantsActivos },
  revenue: { productos, servicios },
  accounts: { porCobrar, porPagar },
  trend: [...],
  breakdown: { bySource, byTenant }
}
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/api/admin/finance/__tests__/route.test.ts`

Expected: FAIL because query params and response keys are not yet implemented.

**Step 3: Write minimal implementation**

- Parse query params with safe defaults.
- Keep global behavior when `tenantId` is absent.
- Return the richer contract while preserving existing totals.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/api/admin/finance/__tests__/route.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/admin/finance/route.ts src/features/admin/api/handlers.ts src/features/admin/actions.ts src/app/api/admin/finance/__tests__/route.test.ts
git commit -m "feat: add filters to global finance report"
```

### Task 3: Rebuild the admin finance page around the new contract

**Files:**
- Modify: `src/app/admin/finanzas/page.tsx`
- Create or modify: `src/app/admin/finanzas/components/finance-filters.tsx`
- Create or modify: `src/app/admin/finanzas/components/finance-kpi-grid.tsx`
- Create or modify: `src/app/admin/finanzas/components/finance-trend-chart.tsx`
- Create or modify: `src/app/admin/finanzas/components/finance-breakdown-panel.tsx`
- Create or modify: `src/app/admin/finanzas/components/finance-accounts-table.tsx`

**Step 1: Write the failing test**

Add a page/component test that asserts the new sections exist: filters, KPI cards, trend area, and breakdown area.

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/admin/finanzas/page.test.tsx`

Expected: FAIL because the new sections do not exist yet.

**Step 3: Write minimal implementation**

- Split the UI into small components.
- Keep default render simple and readable.
- Use the new API response shape to render all sections.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/admin/finanzas/page.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/admin/finanzas/page.tsx src/app/admin/finanzas/components
git commit -m "feat: redesign global finance dashboard"
```

### Task 4: Remove duplication from the main admin dashboard

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Write the failing test**

Add a test or snapshot expectation that the main admin dashboard keeps only the quick finance summary and no longer mirrors the full finance analysis panel.

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/admin/page.test.tsx`

Expected: FAIL if the dashboard still exposes the duplicated section.

**Step 3: Write minimal implementation**

- Reduce `/admin` to a compact summary.
- Link to `/admin/finanzas` for the deep analysis view.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/admin/page.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "refactor: keep admin dashboard summary focused"
```

### Task 5: Verify behavior and document the result

**Files:**
- Modify: `docs/plans/2026-05-13-finanzas-globales.md`

**Step 1: Run the relevant checks**

Run:

```bash
pnpm test -- src/app/api/admin/finance/__tests__/route.test.ts
pnpm test -- src/app/admin/finanzas/page.test.tsx
pnpm test -- src/app/admin/page.test.tsx
pnpm run lint
```

Expected: all pass.

**Step 2: Write the final note**

- Summarize the new finance flow.
- Record any edge cases discovered during implementation.

**Step 3: Commit**

```bash
git add docs/plans/2026-05-13-finanzas-globales.md
git commit -m "docs: add finance global implementation plan"
```
