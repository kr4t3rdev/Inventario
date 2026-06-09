# Tasks: Catalog CRUD Hardening for Almacenes, Unidades, Puntos de Venta, and Proveedores

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 schemas/forms → PR 2 vendors rendering → PR 3 puntos-venta typing/tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Converge shared schemas and remove client validation drift | PR 1 | Touch forms + shared schemas only; no backend semantics change |
| 2 | Fix vendor contract rendering and add deterministic regression test | PR 2 | Small isolated UI contract slice |
| 3 | Remove puntos-venta type hacks and expand action regression tests | PR 3 | Highest risk slice; keep isolated for review |
| 4 | Final typecheck + focused verification cleanup | PR 4 or fold into PR 3 | Only if diff remains reviewable |

---

## Strict TDD Execution Rules

For **every single numbered task below**, follow this loop:

1. Write the smallest failing test first.
2. Run only the focused command for that test.
3. Confirm the failure is the one you expect.
4. Implement the minimal code to pass.
5. Re-run the same focused command.
6. Refactor only after green.
7. Commit the slice before moving to the next risky behavior.

Recommended commands:
- Focused unit test: `pnpm run test:run -- <path>`
- Focused name match: `pnpm run test:run -- <path> -t "<test name>"`
- Type check gate: `pnpm run typecheck`

---

## Phase 1: Baseline and Guard Rails

- [ ] **1.1 Capture the baseline failures to preserve intent**
  - Files: none
  - Run:
    - `pnpm run test:run -- src/features/almacenes/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/unidades/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`
  - Expected: current suites pass or expose existing noise; record baseline before changing behavior.

- [ ] **1.2 Lock current type debt before changing code**
  - Files: `src/features/puntos-venta/actions.ts`, `src/app/busy/unidad/page.tsx`
  - Run: `pnpm run typecheck`
  - Expected: note the exact suppressions and any related compile warnings that the refactor must eliminate.

## Phase 2: Shared Schema Convergence (Work Unit 1)

### Almacenes
- [ ] **2.1 Write a failing test or assertion for almacenes shared schema expectations**
  - Files: `src/features/almacenes/__tests__/actions.test.ts` or new `src/features/almacenes/schemas.test.ts`
  - Add a test that rejects empty `nombre` through the shared schema contract.
  - Run: `pnpm run test:run -- src/features/almacenes/__tests__/actions.test.ts`

- [ ] **2.2 Refactor `almacen-form.tsx` to import the shared schema**
  - Modify: `src/features/almacenes/components/almacen-form.tsx`
  - Import `almacenSchema` from `src/features/almacenes/schemas.ts` and remove the local duplicate schema.
  - Keep current submit flow, toasts, and route navigation unchanged.
  - Run: `pnpm run test:run -- src/features/almacenes/__tests__/actions.test.ts`

### Unidades
- [ ] **2.3 Write a failing test for unidades shared validation contract**
  - Files: `src/features/unidades/__tests__/actions.test.ts` or new `src/features/unidades/schemas.test.ts`
  - Add assertions that empty `nombre` and empty `simbolo` are rejected by the shared schema.
  - Run: `pnpm run test:run -- src/features/unidades/__tests__/actions.test.ts`

- [ ] **2.4 Refactor `unidad-form.tsx` to import the shared schema**
  - Modify: `src/features/unidades/components/unidad-form.tsx`
  - Remove the local `unidadSchema` duplicate and reuse the feature schema.
  - Run: `pnpm run test:run -- src/features/unidades/__tests__/actions.test.ts`

- [ ] **2.5 Remove page-level suppression from `unidad/page.tsx`**
  - Modify: `src/app/busy/unidad/page.tsx`
  - Type the `getUnidadesAction()` result cleanly without `@ts-expect-error`.
  - Preferred outcome: `const unidades: Unidad[] = result.success ? (result.data ?? []) : []`
  - Run: `pnpm run typecheck`

### Vendors
- [ ] **2.6 Write a failing test for vendors shared validation contract**
  - Files: `src/features/vendors/__tests__/actions.test.ts` or new `src/features/vendors/schemas.test.ts`
  - Add assertions that `nombre` cannot be empty according to the shared feature schema.
  - Run: `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`

- [ ] **2.7 Refactor `vendor-form.tsx` to import the shared schema**
  - Modify: `src/features/vendors/components/vendor-form.tsx`
  - Remove the local `vendorSchema` duplicate and reuse `src/features/vendors/schemas.ts`.
  - Preserve current optional fields, code/EAN display, and logo upload behavior.
  - Run: `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`

### Puntos de venta
- [ ] **2.8 Write a failing test for puntos de venta shared validation contract**
  - Files: `src/features/puntos-venta/__tests__/actions.test.ts` and/or new `src/features/puntos-venta/schemas.test.ts`
  - Add assertions for empty `nombre` rejection and explicit handling of nullable `ubicacion` / `listaPrecioId`.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

- [ ] **2.9 Refactor `pvtoVenta-form.tsx` to import the shared schema**
  - Modify: `src/features/puntos-venta/components/pvtoVenta-form.tsx`
  - Remove the local `ptoVentaSchema` duplicate.
  - Remove `zodResolver(... ) as any` by aligning the form value type to the shared schema contract.
  - Keep the UI sentinel translation `"default" -> null` inside the submit handler or a tiny mapper function.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

## Phase 3: Vendors Contract Rendering (Work Unit 2)

- [ ] **3.1 Add a failing regression test for vendor contract display**
  - Create: `src/features/vendors/components/__tests__/vendor-page-client.test.tsx`
  - Test A: vendor with `contrato: 'CTR-001'` renders `CTR-001`.
  - Test B: vendor with `contrato: null` renders `Sin contrato`.
  - Run: `pnpm run test:run -- src/features/vendors/components/__tests__/vendor-page-client.test.tsx`

- [ ] **3.2 Fix vendor table rendering to use `contrato`**
  - Modify: `src/features/vendors/components/vendor-page-client.tsx`
  - Replace the `contratos[]` assumption with rendering based on the actual `contrato` string in the row payload.
  - Keep the current fallback text stable.
  - Run: `pnpm run test:run -- src/features/vendors/components/__tests__/vendor-page-client.test.tsx`

- [ ] **3.3 Verify no action contract changes are accidentally required**
  - Modify only if needed: `src/features/vendors/actions.ts`, `src/app/models/productos.ts`
  - Prefer no backend shape change unless tests prove an actual mismatch beyond the UI consumer.
  - Run:
    - `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/vendors/components/__tests__/vendor-page-client.test.tsx`

## Phase 4: Puntos de Venta Type-Safe Relation Writes (Work Unit 3)

- [ ] **4.1 Add failing tests for create payload with and without `listaPrecioId`**
  - Modify: `src/features/puntos-venta/__tests__/actions.test.ts`
  - Test A: create with `listaPrecioId` connects the relation.
  - Test B: create without `listaPrecioId` sends no relation connect.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

- [ ] **4.2 Add failing tests for update connect/disconnect semantics**
  - Modify: `src/features/puntos-venta/__tests__/actions.test.ts`
  - Test A: update with `listaPrecioId` connects a new list.
  - Test B: update with `listaPrecioId: null` disconnects.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

- [ ] **4.3 Add failing tests for tenant isolation and auth**
  - Modify: `src/features/puntos-venta/__tests__/actions.test.ts`
  - Cover list/get/update/delete under foreign tenant or unauthenticated user.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

- [ ] **4.4 Refactor `puntos-venta/actions.ts` to remove `@ts-expect-error`**
  - Modify: `src/features/puntos-venta/actions.ts`
  - Normalize the Prisma create/update data shape with explicit relation write objects so TypeScript can infer it correctly.
  - Do not widen action input types just to satisfy Prisma.
  - Run: `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`

- [ ] **4.5 Verify the page and form types line up after action cleanup**
  - Modify if needed:
    - `src/features/puntos-venta/components/pv-edit-page-client.tsx`
    - `src/app/busy/puntosDeVenta/update/[id]/page.tsx`
    - `src/features/puntos-venta/types.ts`
  - Remove any residual `as any` usage in the touched path if a clean typed contract is now available.
  - Run: `pnpm run typecheck`

## Phase 5: Regression Hardening and Cleanup

- [ ] **5.1 Expand vendors action tests only if the UI fix exposed a backend assumption**
  - Modify only if needed: `src/features/vendors/__tests__/actions.test.ts`
  - Keep scope limited to payload consistency.
  - Run: `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`

- [ ] **5.2 Re-run focused suites for all four reviewed features**
  - Run:
    - `pnpm run test:run -- src/features/almacenes/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/unidades/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/puntos-venta/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/vendors/__tests__/actions.test.ts`
    - `pnpm run test:run -- src/features/vendors/components/__tests__/vendor-page-client.test.tsx`

- [ ] **5.3 Run the hard type gate**
  - Run: `pnpm run typecheck`
  - Expected: no `@ts-expect-error` or fresh unsafe typing escapes required in touched files.

- [ ] **5.4 Optional only if diff stays reviewable: add tiny doc comments where the contract was previously unclear**
  - Modify if useful:
    - `src/features/puntos-venta/actions.ts`
    - `src/features/vendors/components/vendor-page-client.tsx`
    - `src/features/*/schemas.ts`
  - Keep comments focused on contract intent, not implementation narration.

## Phase 6: Final Verification Checklist

- [ ] Client and server validations agree for touched forms.
- [ ] Vendor contract field is rendered from the actual payload shape.
- [ ] Puntos de venta relation writes are type-safe.
- [ ] Focused tests are green.
- [ ] `pnpm run typecheck` is green.
- [ ] Diff is reviewed per work unit before continuing to the next slice.
