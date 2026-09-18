# Spec: Bulk Price Manager UI

## ADDED Requirements

### Requirement: Bulk Price Manager Page

The system SHALL expose a page at `/busy/ficha-costo/bulk` that lists the tenant's products, lets a manager select a subset via checkboxes, and triggers either a percentage adjustment or a template application through two distinct action buttons. The page SHALL be gated by both the manager role and the `ficha-costo-precios-masivo` plan feature.

#### Scenario: Page renders the product list for the caller's tenant

- **GIVEN** a manager in tenant `T1` with the `ficha-costo-precios-masivo` plan enabled
- **WHEN** the manager navigates to `/busy/ficha-costo/bulk`
- **THEN** the page renders the products returned by `listarProductosParaFichaAction` (filtered to `T1`)
- **AND** each row shows enough context to identify the product (name, code, current `precioVenta`, active template indicator)
- **AND** the page is server-rendered with the data fetch performed before the client component hydrates

#### Scenario: Page is blocked when the plan feature is off

- **GIVEN** a manager in tenant `T1` whose plan does NOT include `ficha-costo-precios-masivo`
- **WHEN** the manager navigates to `/busy/ficha-costo/bulk`
- **THEN** the page returns a 403 (or an explicit "feature not available" empty state) and does NOT render the product table
- **AND** the sidebar entry for "Bulk Price Update" is hidden for this user

#### Scenario: Page is blocked for non-managers

- **GIVEN** a non-manager user in tenant `T1` whose plan DOES include `ficha-costo-precios-masivo`
- **WHEN** the user navigates to `/busy/ficha-costo/bulk`
- **THEN** the page returns a 403 and does NOT render the product table

#### Scenario: Per-row checkbox selection state

- **GIVEN** the page has rendered the product list
- **WHEN** the user clicks a row's checkbox
- **THEN** the row is added to the internal `selected` set and the action bar's "selected count" updates immediately
- **WHEN** the user clicks the same checkbox again
- **THEN** the row is removed from the `selected` set and the count decrements

#### Scenario: Select-all toggle selects every visible product

- **GIVEN** the page has rendered N products
- **WHEN** the user clicks "Seleccionar todos"
- **THEN** every visible row is added to the `selected` set
- **AND** the action bar's "selected count" reads `N`
- **WHEN** the user clicks "Seleccionar todos" again
- **THEN** the `selected` set is cleared

#### Scenario: Action buttons are disabled with empty selection

- **GIVEN** the page has rendered the product list
- **AND** no row is selected
- **THEN** the "Aplicar %" button is disabled
- **AND** the "Aplicar plantilla" button is disabled
- **WHEN** at least one row is selected
- **THEN** both buttons become enabled

#### Scenario: Open the percentage dialog

- **GIVEN** the user has selected at least one product
- **WHEN** the user clicks "Aplicar %"
- **THEN** a confirmation dialog opens with a numeric input for `porcentaje`, the count of selected products, and Cancel / Confirm actions
- **AND** the Confirm button is disabled while the input is empty, non-numeric, zero, or `>= 1000`

#### Scenario: Open the template dialog

- **GIVEN** the user has selected at least one product
- **WHEN** the user clicks "Aplicar plantilla"
- **THEN** a confirmation dialog opens that shows the count of selected products that have an active template
- **AND** the dialog surfaces a "X productos sin plantilla activa" warning when some selected products lack one
- **AND** the Confirm button is disabled when zero selected products have an active template

#### Scenario: Percentage dialog confirmation submits the action

- **GIVEN** the percentage dialog is open with a valid value (e.g. `10`) and 5 products selected
- **WHEN** the user clicks Confirm
- **THEN** the page calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: <5 ids>, tenantId })`
- **AND** a progress indicator appears while the action is in flight
- **AND** the action buttons are disabled during the in-flight request

#### Scenario: Template dialog confirmation submits the action

- **GIVEN** the template dialog is open with 5 products selected and 4 of them having an active template
- **WHEN** the user clicks Confirm
- **THEN** the page calls `bulkApplyTemplateAction({ plantillaId, productoIds: <5 ids> })`
- **AND** a progress indicator appears while the action is in flight
- **AND** the action buttons are disabled during the in-flight request

#### Scenario: Success summary on completion

- **GIVEN** the bulk action completed with `updated = 5, skipped = 0, errors = []`
- **WHEN** the action result returns
- **THEN** the UI displays a success toast and a summary "5 productos actualizados"
- **AND** the `selected` set is cleared
- **AND** the product list is re-fetched (or the page is revalidated) so the new prices are visible

#### Scenario: Partial failure summary on completion

- **GIVEN** the bulk action completed with `updated = 3, skipped = 1, errors = [{ productoId: 'p2', message: '...' }]`
- **WHEN** the action result returns
- **THEN** the UI displays a partial-success toast and a per-row error chip next to the failed row
- **AND** the `selected` set is cleared for successful rows but preserved for failed rows so the user can retry

#### Scenario: Action-level error surfaces to the user

- **GIVEN** the bulk action throws (e.g. validation error, server error, plan revoked mid-session)
- **WHEN** the action result returns `success: false`
- **THEN** the UI displays a toast with the error message and does NOT clear the selection (so the user can retry)
- **AND** the action buttons return to enabled state

#### Scenario: Page does not break with zero products

- **GIVEN** a manager whose tenant has zero products
- **WHEN** the manager navigates to `/busy/ficha-costo/bulk`
- **THEN** the page renders an empty state ("No hay productos para mostrar") and the action buttons remain disabled
