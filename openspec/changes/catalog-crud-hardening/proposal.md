# Proposal: Catalog CRUD Hardening for Almacenes, Unidades, Puntos de Venta, and Proveedores

## Intent

The catalog CRUD modules for `almacenes`, `unidades`, `puntos-venta`, and `vendors` already use Server Actions, but they are not aligned at the contract level. The current implementation has four concrete quality gaps:

1. **Client/server validation drift**: several forms define local Zod schemas that are weaker than the shared feature schemas already used by the Server Actions.
2. **Type debt**: `puntos-venta` and `unidad` currently rely on `@ts-expect-error` / `as any` to bypass broken contracts.
3. **Broken vendor contract rendering**: the vendors table renders `contratos[]`, while the action/model payload only exposes `contrato`.
4. **Insufficient regression protection**: `puntos-venta` tests are shallow and do not protect tenant isolation, validation, or relation behavior.

This change hardens those CRUDs without changing their business purpose. The goal is to make the modules **strictly validated, type-safe, and test-driven** so future work can build on a reliable base.

## Scope

### In Scope
- Reuse shared feature Zod schemas as the source of truth for form validation.
- Remove `@ts-expect-error` / `as any` from the reviewed modules.
- Fix vendor contract rendering so the UI matches the actual payload shape.
- Strengthen tests for `puntos-venta`, and add missing targeted regression tests for the reviewed slices.
- Keep existing navigation, toasts, and CRUD semantics unless a failing test proves they are wrong.

### Out of Scope
- New business features for these CRUDs.
- Database schema changes unrelated to the reviewed contract issues.
- Full visual redesign of the pages.
- Migrating unrelated legacy modules to Server Actions.

## Capabilities

### New / Hardened Capabilities
- `catalog-shared-validation-source`: client forms and server actions MUST use the same schema source.
- `catalog-crud-type-safety`: reviewed modules MUST compile without local type suppressions.
- `vendors-contract-display-consistency`: vendor list/detail UI MUST render the contract field that the backend actually returns.
- `puntos-venta-regression-protection`: relation handling and tenant isolation MUST be covered by focused tests.

## Approach

1. **Lock current defects with tests first**
   - Add failing tests around payload shape, validation expectations, and relation behavior.
2. **Converge contracts**
   - Export/reuse shared schemas and normalized types instead of duplicating local form schemas.
3. **Fix the smallest surface that restores consistency**
   - Prefer adapting the UI to the existing backend contract unless a broader domain requirement forces a different contract.
4. **Prove with focused verification**
   - Run targeted Vitest suites and typecheck on touched slices.

## Affected Areas

| Area | Impact | Why |
|------|--------|-----|
| `src/features/almacenes/*` | Modified | Reuse shared schema in form; preserve action contract |
| `src/features/unidades/*` | Modified | Reuse shared schema, remove type suppression, preserve uniqueness rules |
| `src/features/puntos-venta/*` | Modified | Remove type hacks, align form/action types, expand tests |
| `src/features/vendors/*` | Modified | Fix contract rendering and keep enriched vendor payload consistent |
| `src/app/busy/{almacen,unidad,puntosDeVenta,vendor}/*` | Possibly modified | Clean page-level typing where suppressions exist |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hidden consumers depend on current weak form validation | Medium | Keep server-side behavior as authority; only tighten client-side behavior to match it |
| Fixing vendor contract could break an assumed array-based UI path | Low | Prefer a single-field rendering path backed by tests |
| Removing type suppressions may reveal larger contract gaps | Medium | Handle one slice at a time with red/green/refactor and small commits |
| Scope could exceed comfortable review size | High | Plan as chained work units and stop before apply if risk remains high |

## Rollback Plan

1. Revert per work unit if one slice destabilizes another.
2. Keep backend action behavior stable while refactoring client consumers.
3. If a form tightening causes UX regressions, revert only the client validation wiring and retain the action/test improvements.

## Success Criteria

- [ ] Reviewed forms use shared feature schemas instead of weaker local duplicates.
- [ ] `src/features/puntos-venta/actions.ts` no longer needs `@ts-expect-error`.
- [ ] `src/app/busy/unidad/page.tsx` no longer needs `@ts-expect-error`.
- [ ] Vendors UI renders the actual contract field returned by actions.
- [ ] `puntos-venta` tests cover create/update/delete/list/get, validation, auth, tenant isolation, and `listaPrecio` relation behavior.
- [ ] Targeted tests pass under `pnpm run test:run`.
- [ ] Touched code passes `pnpm run typecheck` with no new suppressions.
