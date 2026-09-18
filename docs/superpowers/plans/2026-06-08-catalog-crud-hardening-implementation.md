# Catalog CRUD Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave almacenes, unidades, puntos de venta, and proveedores aligned on shared validation contracts, clean typing, and review-backed regressions without breaking the existing admin CRUD flows.

**Architecture:** Preserve the existing Server Action boundaries and admin CRUD pages. Tighten the client contracts around the shared feature schemas, remove remaining unsafe casts, and keep `pvtoVenta-form.tsx` because it powers the admin CRUD for points of sale, while `pv-interface.tsx` is the sales UI that only consumes points of sale as a selector.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, React Hook Form, Zod, Prisma, Vitest, Testing Library.

---

## Verified usage map: `pvtoVenta-form.tsx` vs `pv-interface.tsx`

### `src/features/ventas/components/pv-interface.tsx`
**What it is for:** sales / POS selling experience.
- Uses `usePuntosDeVenta()` to **select** a point of sale for making a sale.
- Does **not** create or edit a `PuntoDeVenta` entity.
- This file is unrelated to the admin CRUD form contract.

### `src/features/puntos-venta/components/pvtoVenta-form.tsx`
**What it is for:** admin CRUD for `PuntoDeVenta`.

Verified usage:
- `src/features/puntos-venta/components/pv-new-page-client.tsx`
  - renders `<PtoVentaForm />`
  - purpose: create a new point of sale from `/busy/puntosDeVenta/new`
- `src/features/puntos-venta/components/pv-edit-page-client.tsx`
  - renders `<PtoVentaForm initialData={puntoVenta} />`
  - purpose: edit an existing point of sale from `/busy/puntosDeVenta/update/[id]`
- `src/app/busy/puntosDeVenta/new/page.tsx`
  - route entry for the create screen
- `src/app/busy/puntosDeVenta/update/[id]/page.tsx`
  - route entry for the edit screen

### Decision
- [ ] **Do NOT delete `pvtoVenta-form.tsx`.**
- [ ] Keep it because it is actively used by the admin CRUD screens.
- [ ] Treat `pv-interface.tsx` and `pvtoVenta-form.tsx` as different responsibilities.

---

## File responsibility map for this implementation

- `src/features/almacenes/components/almacen-form.tsx`
  - client form for admin CRUD of almacenes
- `src/features/unidades/components/unidad-form.tsx`
  - client form for admin CRUD of unidades
- `src/app/busy/unidad/page.tsx`
  - server page consuming `getUnidadesAction()`
- `src/features/puntos-venta/components/pvtoVenta-form.tsx`
  - admin CRUD form for puntos de venta
- `src/features/puntos-venta/form-values.ts`
  - UI-to-domain mapper for `PtoVentaFormValues` so the `'default'` sentinel never leaks into `PvInput`
- `src/features/puntos-venta/__tests__/form-values.test.ts`
  - strict TDD regression for the UI sentinel mapping
- `src/features/puntos-venta/actions.ts`
  - action contract for CRUD of puntos de venta
- `src/app/busy/puntosDeVenta/update/[id]/page.tsx`
  - edit page still has `as any` and must be cleaned
- `src/features/vendors/components/vendor-form.tsx`
  - client form for admin CRUD of proveedores
- `src/features/vendors/components/vendor-page-client.tsx`
  - vendors table and detail UI
- `src/features/vendors/components/__tests__/vendor-page-client.test.tsx`
  - regression test for contrato rendering
- `src/features/puntos-venta/__tests__/actions.test.ts`
  - action-level regression suite for puntos de venta

---

## Task 1: Freeze the verified usage contract for Punto de Venta UIs

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-catalog-crud-hardening-implementation.md`
- Optional doc comment only if useful: `src/features/puntos-venta/components/pvtoVenta-form.tsx`
- Optional doc comment only if useful: `src/features/ventas/components/pv-interface.tsx`

- [ ] **Step 1: Add a short code comment clarifying the role of `pvtoVenta-form.tsx`**

```tsx
/**
 * Admin CRUD form for PuntoDeVenta.
 * This is not the POS selling interface used in ventas.
 */
```

- [ ] **Step 2: Add a short code comment clarifying the role of `VentaInterface` only if missing**

```tsx
/**
 * Sales UI for making ventas from an existing PuntoDeVenta.
 * Consumes points of sale but does not manage PuntoDeVenta CRUD.
 */
```

- [ ] **Step 3: Do not change runtime behavior in this task**

Run: no command required
Expected: documentation-only clarification, zero behavior changes

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-06-08-catalog-crud-hardening-implementation.md src/features/puntos-venta/components/pvtoVenta-form.tsx src/features/ventas/components/pv-interface.tsx
git commit -m "docs: clarify punto de venta form and POS interface roles"
```

---

## Task 2: Keep shared schemas, but remove the remaining admin edit cast in Punto de Venta

**Files:**
- Modify: `src/app/busy/puntosDeVenta/update/[id]/page.tsx`
- Read: `src/features/puntos-venta/types.ts`
- Read: `src/app/models/punto-venta.ts`
- Test: `pnpm run typecheck`

- [ ] **Step 1: Write the failing type expectation mentally by removing the cast**

Current problematic line:

```tsx
return <EditarPvPageClient puntoVenta={puntoVenta as any} />
```

Target outcome:

```tsx
return <EditarPvPageClient puntoVenta={puntoVenta} />
```

- [ ] **Step 2: Inspect the declared prop type of `EditarPvPageClient` and align it to the real action payload**

Use the existing model shape instead of `any`. Prefer a dedicated prop type like:

```tsx
interface PvEditPageClientProps {
  puntoVenta: {
    pvId: string
    nombre: string
    ubicacion: string | null
    listaPrecioId?: string | null
  } | null
}
```

- [ ] **Step 3: Make the minimal implementation change**

Likely changes:
- widen `ubicacion` from `string` to `string | null`
- keep `listaPrecioId?: string | null`
- remove `as any` from the page

- [ ] **Step 4: Run typecheck to verify the cast is no longer needed**

Run:

```bash
pnpm run typecheck
```

Expected: no type error from `src/app/busy/puntosDeVenta/update/[id]/page.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/app/busy/puntosDeVenta/update/[id]/page.tsx src/features/puntos-venta/components/pv-edit-page-client.tsx
git commit -m "refactor: remove unsafe cast from punto de venta edit page"
```

---

## Task 3: Fix the Punto de Venta form contract properly (remove UI sentinel from domain type)

**Files:**
- Modify: `src/features/puntos-venta/components/pvtoVenta-form.tsx`
- Create: `src/features/puntos-venta/form-values.ts`
- Create: `src/features/puntos-venta/__tests__/form-values.test.ts`
- Read: `src/features/puntos-venta/schemas.ts`
- Test: `src/features/puntos-venta/__tests__/actions.test.ts`
- Verify: `pnpm run typecheck`

- [ ] **Step 1: Write the failing mapper test first**

Create `src/features/puntos-venta/__tests__/form-values.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { toPvInput } from '@/features/puntos-venta/form-values'

describe('toPvInput', () => {
  it('maps the UI sentinel "default" to null', () => {
    expect(
      toPvInput({
        nombre: 'Sucursal Centro',
        ubicacion: 'Av. Principal',
        listaPrecioId: 'default',
      })
    ).toEqual({
      nombre: 'Sucursal Centro',
      ubicacion: 'Av. Principal',
      listaPrecioId: null,
    })
  })

  it('maps empty optional fields to null', () => {
    expect(
      toPvInput({
        nombre: 'Sucursal Norte',
        ubicacion: '',
        listaPrecioId: '',
      })
    ).toEqual({
      nombre: 'Sucursal Norte',
      ubicacion: null,
      listaPrecioId: null,
    })
  })

  it('preserves a real listaPrecioId', () => {
    expect(
      toPvInput({
        nombre: 'Sucursal Sur',
        ubicacion: null,
        listaPrecioId: 'lp-1',
      })
    ).toEqual({
      nombre: 'Sucursal Sur',
      ubicacion: null,
      listaPrecioId: 'lp-1',
    })
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
pnpm exec vitest run src/features/puntos-venta/__tests__/form-values.test.ts
```

Expected: FAIL because `@/features/puntos-venta/form-values` does not exist yet

- [ ] **Step 3: Define a UI-specific form type in a dedicated mapper file**

Create `src/features/puntos-venta/form-values.ts`:

```ts
import { pvSchema, type PvInput } from '@/features/puntos-venta/schemas'

type PtoVentaFormValues = {
  nombre: string
  ubicacion?: string | null
  listaPrecioId?: string | null | 'default'
}

export function toPvInput(values: PtoVentaFormValues): PvInput {
  return {
    nombre: values.nombre,
    ubicacion: values.ubicacion?.trim() ? values.ubicacion : null,
    listaPrecioId:
      values.listaPrecioId === 'default' || !values.listaPrecioId
        ? null
        : values.listaPrecioId,
  }
}

export function parsePvFormValues(values: PtoVentaFormValues): PvInput {
  return pvSchema.parse(toPvInput(values))
}
```

Why: `default` is a UI sentinel, not domain input, and strict TDD needs this mapping isolated behind a tiny testable unit.

- [ ] **Step 4: Run the new mapper test again**

Run:

```bash
pnpm exec vitest run src/features/puntos-venta/__tests__/form-values.test.ts
```

Expected: PASS

- [ ] **Step 5: Change the form typing to the UI type**

```ts
const form = useForm<PtoVentaFormValues>({
  resolver: zodResolver(pvSchema),
  defaultValues: {
    nombre: initialData?.nombre || '',
    ubicacion: initialData?.ubicacion || '',
    listaPrecioId: initialData?.listaPrecioId || 'default',
  },
})
```

In `pvtoVenta-form.tsx`, import the type from the new mapper file:

```ts
import {
  parsePvFormValues,
  type PtoVentaFormValues,
} from '@/features/puntos-venta/form-values'
```

Do **not** lie to TypeScript by calling that `PvInput`.

- [ ] **Step 6: Use the mapper inside submit and validate the mapped payload**

```ts
async function onSubmit(values: PtoVentaFormValues) {
  const data = parsePvFormValues(values)
  // use `data` from here forward
}
```

This preserves the shared schema as the real contract while keeping the UI sentinel local.

- [ ] **Step 7: Run the focused puntos de venta suite**

Run:

```bash
pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts
```

Expected: your action tests still pass; no behavior drift in CRUD actions

- [ ] **Step 8: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: no typing regressions from `pvtoVenta-form.tsx`

- [ ] **Step 9: Commit**

```bash
git add src/features/puntos-venta/components/pvtoVenta-form.tsx src/features/puntos-venta/form-values.ts src/features/puntos-venta/__tests__/form-values.test.ts
git commit -m "refactor: isolate punto de venta form ui values from domain input"
```

---

## Task 4: Make the Vendor contract regression test actually valuable

**Files:**
- Modify: `src/features/vendors/components/__tests__/vendor-page-client.test.tsx`
- Read: `src/features/vendors/components/vendor-page-client.tsx`

- [ ] **Step 1: Reduce mocking surface where possible**

Keep only the mocks needed for:
- router
- motion wrappers
- heavy shell components if they are blocking rendering

Avoid over-mocking `DataTable` in a way that reimplements its core behavior incorrectly.

- [ ] **Step 2: If `DataTable` must stay mocked, make the test assert the column contract more explicitly**

At minimum, assert that the `contrato` accessor path is the one exercised:

```ts
expect(screen.getByTestId('contrato-cell')).toBeInTheDocument()
```

And keep the real expectation:

```ts
expect(screen.getByText('CTR-001')).toBeInTheDocument()
expect(screen.getByText('Sin contrato')).toBeInTheDocument()
```

- [ ] **Step 3: Use proper Testing Library matchers**

Replace weak assertions like:

```ts
expect(screen.getByText('CTR-001')).toBeDefined()
```

with:

```ts
expect(screen.getByText('CTR-001')).toBeInTheDocument()
```

- [ ] **Step 4: Run the focused vendor component test**

Run:

```bash
pnpm exec vitest run src/features/vendors/components/__tests__/vendor-page-client.test.tsx
```

Expected: only the vendor component test runs and passes

- [ ] **Step 5: Commit**

```bash
git add src/features/vendors/components/__tests__/vendor-page-client.test.tsx
git commit -m "test: strengthen vendor contract rendering regression"
```

---

## Task 5: Verify the shared-schema convergence work with targeted checks

**Files:**
- Read/verify only:
  - `src/features/almacenes/components/almacen-form.tsx`
  - `src/features/unidades/components/unidad-form.tsx`
  - `src/features/vendors/components/vendor-form.tsx`
  - `src/app/busy/unidad/page.tsx`

- [ ] **Step 1: Re-run the touched action suites**

Run:

```bash
pnpm run test:run -- src/features/almacenes/__tests__/actions.test.ts
pnpm run test:run -- src/features/unidades/__tests__/actions.test.ts
pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts
```

Expected: all three suites stay green after the schema convergence changes

- [ ] **Step 2: Run typecheck after the whole slice**

Run:

```bash
pnpm run typecheck
```

Expected: no new suppressions needed

- [ ] **Step 3: Commit if no changes were needed in this verification task**

```bash
git add -A
git commit -m "chore: verify catalog crud shared-schema convergence"
```

---

## Task 6: Final implementation gate before asking for review

**Files:**
- No new files required

- [ ] **Step 1: Review the diff only for the intended scope**

Run:

```bash
git diff -- src/features/almacenes src/features/unidades src/features/puntos-venta src/features/vendors src/app/busy/almacen src/app/busy/unidad src/app/busy/puntosDeVenta src/app/busy/vendor
```

Expected: diff contains only the CRUD-hardening scope, not unrelated category/auth/platform changes

- [ ] **Step 2: Re-run the two highest-value focused checks**

Run:

```bash
pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts
pnpm exec vitest run src/features/vendors/components/__tests__/vendor-page-client.test.tsx
pnpm run typecheck
```

Expected: all three pass

- [ ] **Step 3: Request review only after those three are green**

Suggested review scope:
- contract purity in `pvtoVenta-form.tsx`
- vendor contract rendering test quality
- removal of the punto de venta edit-page cast

- [ ] **Step 4: Commit the final slice**

```bash
git add src/features/puntos-venta src/features/vendors src/features/almacenes src/features/unidades src/app/busy/puntosDeVenta src/app/busy/unidad docs/superpowers/plans/2026-06-08-catalog-crud-hardening-implementation.md
git commit -m "refactor: harden catalog crud contracts"
```

---

## Self-review results

### Spec coverage
This plan covers:
- shared schema convergence
- vendor `contrato` rendering
- puntos de venta type cleanup
- preservation of admin CRUD usage for `pvtoVenta-form.tsx`

### Placeholder scan
No `TODO`, `TBD`, or vague “write tests” placeholders remain.

### Type consistency
- `PvInput` remains the domain input contract.
- `PtoVentaFormValues` is introduced as the UI-only type if you execute Task 3.
- `pv-interface.tsx` stays outside CRUD refactors.
