# Spec: Plan Feature Gate

## ADDED Requirements

### Requirement: ficha-costo-precios-masivo plan key

The system SHALL recognize the plan key `ficha-costo-precios-masivo` and grant it to the `Empresarial` plan tier only. The key SHALL gate both server actions (`bulkApplyPercentageAction`, `bulkApplyTemplateAction`), the page route (`/busy/ficha-costo/bulk`), and the sidebar entry that links to it.

#### Scenario: Empresarial plan grants the bulk-price feature

- **GIVEN** a tenant on the `Empresarial` plan
- **AND** a manager user in that tenant
- **WHEN** the manager's feature set is resolved at session time
- **THEN** `ficha-costo-precios-masivo` is included in the resolved feature list
- **AND** the page `/busy/ficha-costo/bulk` is reachable
- **AND** the sidebar entry "Bulk Price Update" is rendered

#### Scenario: Non-Empresarial plan does not grant the bulk-price feature

- **GIVEN** a tenant on a plan tier other than `Empresarial` (e.g. `Basico`, `Pro`)
- **AND** a manager user in that tenant
- **WHEN** the manager's feature set is resolved at session time
- **THEN** `ficha-costo-precios-masivo` is NOT included
- **AND** the sidebar entry is hidden
- **AND** a direct navigation to `/busy/ficha-costo/bulk` returns a 403 (or an explicit "feature not available" empty state)
- **AND** direct calls to `bulkApplyPercentageAction` / `bulkApplyTemplateAction` from the client are rejected with `ActionError` and code `FORBIDDEN` (or `FEATURE_NOT_ENABLED`)

#### Scenario: Non-manager on Empresarial plan is still blocked

- **GIVEN** a non-manager user in a tenant on the `Empresarial` plan
- **WHEN** the user's permissions are evaluated
- **THEN** the bulk-price feature is not granted (role check is enforced independently of plan)
- **AND** the page and actions return 403 / `FORBIDDEN`

#### Scenario: Plan revocation takes effect on the next request

- **GIVEN** a manager currently has `ficha-costo-precios-masivo` enabled
- **AND** the tenant's plan is downgraded from `Empresarial` to a lower tier
- **WHEN** the manager makes a new request that touches the bulk-price surface
- **THEN** the feature is no longer granted
- **AND** the page, sidebar entry, and server actions behave as in the "Non-Empresarial" scenario

#### Scenario: Seed and runtime plan definitions stay consistent

- **GIVEN** the `prisma/seed/plans-seed.ts` file declares `ficha-costo-precios-masivo` for `Empresarial`
- **WHEN** the application reads plan features at runtime (server-side `requireFeature` helper, sidebar feature resolution, etc.)
- **THEN** the runtime view of plan features matches the seed for the `Empresarial` tier — no drift between seed and runtime checks
