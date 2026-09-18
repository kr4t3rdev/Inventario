# Tasks: Plantilla de ficha de costo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema, types, calc lib, actions + tests | PR 1 | Foundation; independent of UI |
| 2 | UI components, wiring, UI tests | PR 2 | Depends on PR 1 actions/types |

## Phase 1: Foundation

- [ ] 1.1 `prisma/schema.prisma`: add `ProductoCostSheetTemplate` with fields, `@@unique([productoId, esActiva])`, `@@index([tenantId])`, relations to `Producto`, `Tenant`, `User`.
- [ ] 1.2 Run `npx prisma migrate dev --name add_producto_cost_sheet_template`.
- [ ] 1.3 `src/features/ficha-costo/types-plantilla.ts`: create `PlantillaCosto`, `CreatePlantillaInput`, `UpdatePlantillaInput`, `AplicarPrecioInput`. Merge into `types.ts` barrel.

## Phase 2: Core Logic (TDD)

- [ ] 2.1 RED: `__tests__/template-calc.test.ts` — 5 tests (margen 30 %, 0 %, 100 % error, negative error, decimal precision).
- [ ] 2.2 GREEN: `src/features/ficha-costo/lib/template-calc.ts` — `calcularPrecioSugerido` with Decimal; throw if `margenObjetivo >= 1` or `< 0`.
- [ ] 2.3 RED: `__tests__/actions-plantilla.test.ts` — 10 tests (list, active, create, update, activate tx, delete, apply price, idempotency, multi-tenant 404, audit log).
- [ ] 2.4 GREEN: `src/features/ficha-costo/actions-plantilla.ts` queries — `getPlantillasAction`, `getPlantillaActivaAction`.
- [ ] 2.5 GREEN: `src/features/ficha-costo/actions-plantilla.ts` mutations — `createPlantillaAction` (auto-version, server calc), `updatePlantillaAction` (block calc fields), `activarPlantillaAction` (atomic tx, map `P2002`), `deletePlantillaAction` (soft-delete, block active), `aplicarPrecioSugeridoAction` (audit log). Re-export in `actions.ts` barrel.
- [ ] 2.6 REFACTOR: JSDoc all actions, extract shared validation helpers.

## Phase 3: UI (TDD)

- [ ] 3.1 RED: `__tests__/plantilla-tab.test.tsx` — 5 tests (empty state, active render, version list, activate flow, apply button permission).
- [ ] 3.2 GREEN: `components/plantilla-form.tsx` — create/edit form with materiales, MO, indirectos, margen.
- [ ] 3.3 GREEN: `components/plantilla-tab.tsx` — active display, versions table, empty state, action buttons.
- [ ] 3.4 GREEN: `components/comparacion-plantilla-card.tsx` — delta colors, tabular-nums.
- [ ] 3.5 GREEN: `ficha-costo-view.tsx` add "Plantilla" tab; `resumen-costo.tsx` include comparison card.
- [ ] 3.6 REFACTOR: lazy-load tab, a11y labels, consistent formatting.

## Phase 4: Verification

- [ ] 4.1 `pnpm run lint`.
- [ ] 4.2 `pnpm test:run src/features/ficha-costo` — coverage > 80 %.
- [ ] 4.3 Conventional commit.
