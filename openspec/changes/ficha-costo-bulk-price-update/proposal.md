# Proposal: Bulk Price Update — Ficha de Costo

**Change**: `ficha-costo-bulk-price-update`
**Phase**: 1 of 2 (% adjustment + apply template)
**Module**: Ficha de Costo (Feature 4)

---

## Why

The Ficha de Costo module currently lets managers adjust `precioVenta` one product at a time, and apply a Cost Sheet Template's suggested price one product at a time. Both flows work, but they don't scale:

- **Price-list refresh** (e.g. a 10% cost-driven increase across the catalog) requires hundreds of manual edits.
- **Template rollout** (a new margin policy applied to all products that have a template) is the same problem: hundreds of single clicks.
- **Operations team feedback** (per Arturo's clarification): managers are doing this work today via CSV exports and bulk SQL — there's no safe, auditable UI for it.

This change adds the missing bulk actions to the Ficha de Costo module. It targets managers on the `Empresarial` plan tier and is gated behind a new plan key.

**Phase 1** ships the two highest-leverage actions: percentage adjustment and apply-template. **Phase 2** (grid editing, deferred) covers the remaining ~10% of cases where neither rule fits.

---

## What Changes

### New server actions (`src/features/ficha-costo/actions-bulk.ts`)

| Action | Input | Behavior |
|--------|-------|----------|
| `bulkAdjustPrecioVentaAction` | `{ productoIds: string[], percent: number, notes?: string }` | For each product in the tenant: read current `precioVenta`, compute `Math.round(pv * (1 + percent/100))`, write new value, record a `ProductoCostHistory` row with `CostChangeReason.ADJUSTMENT` and a notes string like `"Ajuste masivo +10%"`. |
| `bulkApplyPlantillaAction` | `{ productoIds: string[], notes?: string }` | For each product in the tenant that has an active `ProductoCostSheetTemplate`: round `plantilla.precioSugerido` → write as new `precioVenta`, record `ProductoCostHistory` with `CostChangeReason.MANUAL_EDIT` and notes `"Precio sugerido aplicado desde plantilla v{N} (masivo)"`. Products without an active template are reported back, not failed. |

Both actions return `{ updated: number, skipped: number, errors: Array<{ productoId, message }>, results: Array<{ productoId, oldPrecioVenta, newPrecioVenta }> }` and call `revalidatePath` on `/busy/ficha-costo` and `/busy/ficha-costo/bulk`.

### New shared UI shell (`src/features/ficha-costo/components/bulk-price-manager.tsx` + client wrapper)

- Reuses the `BulkStockMinimoManager` blueprint (hand-rolled table with Radix `Checkbox`, per-row `isSelected`).
- New page `/busy/ficha-costo/bulk` lists products with checkbox column and a sticky action bar.
- Two confirm dialogs: one for `%` (with input), one for "Apply template" (with count of products that have an active template).
- Progress + per-row error UI mirrors the existing `bulkUpdateStockMinimoAction` pattern.

### Small refactor

- `src/lib/cost-history-utils.ts`: `recordCostChange` accepts an optional `existingProducto` parameter to skip its internal `findUnique` when the caller already has the row. **No signature change for existing callers** — fully backward compatible.

### Wiring

- New plan key `ficha-costo-precios-masivo` in `prisma/seed/plans-seed.ts`, enabled for the `Empresarial` plan only. Mirrors the existing `productos-stock-masivo` key.
- New sidebar entry under "Ficha de Costo" → `/busy/ficha-costo/bulk` (`Percent` icon).
- Manager-role gate via `requireManagerRole` + `requireFeature(user, 'ficha-costo-precios-masivo', ...)`, same pattern as `updatePrecioCostoAction`.

### Tests

- `actions-bulk.test.ts` — happy path, multi-tenant rejection, validation (negative percent, empty ids, missing template), partial failure, chunk behavior at 50.
- `bulk-price-manager.test.tsx` — render, selection state, disabled state when no selection, confirm-dialog copy.

---

## Impact

| Area | Impact | Notes |
|------|--------|-------|
| `src/features/ficha-costo/actions-bulk.ts` | New | 2 server actions |
| `src/features/ficha-costo/components/bulk-price-manager.tsx` | New | UI shell |
| `src/app/busy/ficha-costo/bulk/page.tsx` | New | Server-first page with plan gate |
| `src/lib/cost-history-utils.ts` | Modified | Optional `existingProducto` param, backward compatible |
| `prisma/seed/plans-seed.ts` | Modified | New plan key `ficha-costo-precios-masivo` |
| `src/components/app-sidebar2.tsx` | Modified | New sidebar entry |
| `src/features/ficha-costo/types.ts` | Modified | New input/result types |
| `src/features/ficha-costo/actions.ts` | Modified | Re-export the 2 new actions |

**Breaking changes**: None. The `recordCostChange` refactor is additive only.

**Schema migrations**: None. `CostChangeReason.ADJUSTMENT` and `MANUAL_EDIT` are reused.

**Test suite**: Current 123/123 baseline is preserved. New tests added on top.

---

## Out of Scope

The following are explicitly **NOT** in this proposal. They are tracked for a future phase.

- **Grid editing** (sub-feature 3): in-table `precioVenta` editing with controlled inputs, modified-row highlighting, and per-row save. This is **Phase 2** (`ficha-costo-bulk-price-update-grid` or follow-up change). Rationale for deferring: grid editing subsumes features 1 and 2 — a user can type values directly, apply %, or apply template from the same surface. Doing it last avoids redoing the action bar UI. Estimated effort: 3-5 days. No work is wasted: the server actions and plan key from Phase 1 are reused verbatim.
- **Undo / revert UI**: the `ProductoCostHistory` rows written by these actions make manual revert possible via SQL, but there is no in-app undo flow. Tracked as follow-up.
- **Bulk adjust `precioCosto`**: out of scope. The cost side has its own audit cadence and is typically driven by restocks, not bulk edits.
- **New `CostChangeReason` values** (`BULK_ADJUSTMENT`, `BULK_PLANTILLA`): reusing existing reasons with descriptive `notes` strings keeps the migration-free path. Can be added later if reporting needs it.
- **Increasing the product list limit beyond 500**: the chunked transaction cap of 50 products per action is a safety net. The list limit is unchanged in this phase.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Multi-tenant data leak** via the bulk action writing across tenants | Med | Pattern from `bulkUpdateContratoStatusAction` (not from `bulkUpdateStockMinimoAction`): every `findFirst` / `update` includes `tenantId` in the `where` clause. Tests assert cross-tenant ids are rejected. |
| **Performance with N=500** (~2000 queries) | Med | Chunked `$transaction` of 50 products max. Refactor `recordCostChange` to accept `existingProducto` and skip its N+1 `findUnique`. The list page keeps its 500 cap; bulk action timeout-protected. |
| **Partial failures** (5 of 500 fail mid-loop) | Med | Return `{ updated, skipped, errors, results }` and render per-row error chips. Failures don't abort the whole batch. Mirrors the existing `bulkUpdateStockMinimoAction` contract. |
| **Rounding drift** (`100 * 1.1 = 110.00000000000001`) | Low | `Math.round` applied to the computed value, same as `aplicarPrecioSugeridoAction` does today. Tested with boundary values. |
| **Race condition with single-product edit** (manager A in ficha, manager B running bulk) | Low | Bulk reads the value at the moment it processes that product. No optimistic locking. Acceptable for the domain (manual, non-transactional editing). Documented in code comment. |
| **Plan key not granted to the right tier** | Low | Key is `ficha-costo-precios-masivo`, enabled only for `Empresarial` (same tier as `productos-stock-masivo`). To be confirmed with Arturo before apply. |
| **Manager without `ficha-costo-precios-masivo` plan** tries the URL | Low | Server-side `requireFeature` gate on the page. Page returns 403, sidebar entry is hidden when plan is off. |
| **No active template on selected products** | Med | `bulkApplyPlantillaAction` reports `skipped` count; UI shows "X productos sin plantilla activa" before confirm. |

---

## Success Criteria

- [ ] Manager can select N products, apply `+X%` / `-X%`, and see all prices updated in one batch with a single confirmation.
- [ ] Manager can apply the active Cost Sheet Template to N products in one batch; products without an active template are reported as skipped, not failed.
- [ ] Every bulk write produces a `ProductoCostHistory` row with the correct reason, old/new prices, and the acting `userId`.
- [ ] Multi-tenant isolation: a product belonging to another tenant cannot be updated even if its id is submitted.
- [ ] Partial failure UX: if some products fail, the rest still update and the UI shows which ones failed.
- [ ] Sidebar entry and `/busy/ficha-costo/bulk` page are visible only to managers on the `Empresarial` plan.
- [ ] Test suite stays green (123 baseline + new tests, all passing).

---

## Rollback Plan

The change is additive: two new server actions, one new page, one new sidebar entry, one optional `existingProducto` param in `recordCostChange`.

**Revert path** (in order):
1. Remove the sidebar entry (single line in `app-sidebar2.tsx`).
2. Remove the page route (`src/app/busy/ficha-costo/bulk/`).
3. Remove the two re-exports from `src/features/ficha-costo/actions.ts`.
4. Remove `src/features/ficha-costo/actions-bulk.ts` and the `bulk-price-manager.tsx` component.
5. Revert the `recordCostChange` refactor (one signature addition, no behavior change for existing callers — safe to remove).
6. Disable the `ficha-costo-precios-masivo` plan key (do not delete it; keep for re-enable).

No data is created beyond `ProductoCostHistory` rows. Rolling back the actions does not orphan the history rows; they remain valid audit records.

---

## Dependencies

- **No new npm packages.** All needed primitives (`@radix-ui/react-checkbox`, `@radix-ui/react-alert-dialog`, `@tanstack/react-table`, `sonner`, `framer-motion`, `zod`, `lucide-react`) are already in the project.
- **No Prisma migration.** Schema is unchanged.
- **External**: confirmation from Arturo on the plan tier for the new key (`Empresarial` recommended, mirroring `productos-stock-masivo`).

---

## Phase 2 Preview (NOT in this proposal)

- New change (suggested name: `ficha-costo-bulk-price-update-grid`) covering grid editing.
- Reuses Phase 1 server actions and plan key verbatim.
- Estimated 3-5 days; starts only after Phase 1 ships and the action bar pattern is validated in production.
