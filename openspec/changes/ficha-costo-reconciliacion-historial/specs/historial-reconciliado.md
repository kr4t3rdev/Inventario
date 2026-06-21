# Spec: Historial Reconciliado (Ficha de Costo)

## Purpose
Exponer el historial de compras de un producto reconciliado con el cálculo del CPP, de modo que el usuario pueda auditar línea por línea qué compras entraron en la ventana, cuánto gasto proporcional se le imputó a cada una, y qué proveedor pesa más en el costo, a través de la Server Action `getHistorialReconciliadoAction` con un payload estructurado que la UI consume.

## Requirements

### Requirement: Server Action getHistorialReconciliadoAction
The system SHALL expose a Server Action `getHistorialReconciliadoAction` that, given a `productoId`, returns the list of purchase items reconciled with the CPP calculation, a per-supplier summary, the `estadoCPP` del cálculo, la ventana utilizada y la lista de advertencias producidas por el reconciliador.

#### Scenario: Items within the 12-month window are flagged as included
- **GIVEN** a product with 5 purchase items registered in the last 12 months AND 2 purchase items registered more than 12 months ago (all from the same tenant)
- **WHEN** an authenticated user with access to the tenant calls `getHistorialReconciliadoAction({ productoId })`
- **THEN** the response MUST succeed (`success: true`)
- **AND** the response MUST contain exactly 7 entries in `items`
- **AND** the 5 items with `fecha` inside the 12-month window MUST have `enVentanaCPP: true`
- **AND** the 2 items with `fecha` outside the 12-month window MUST have `enVentanaCPP: false`
- **AND** the response MUST include `ventana = { meses: 12, desde, hasta }` calculated relative to the current date

#### Scenario: Proportional expense is prorated by quantity within the same document
- **GIVEN** a product with 3 purchase items that belong to the same `compraDocumento`
- **AND** each of the 3 items has `cantidad: 10`
- **AND** that document has an associated `GastoCompra` with `total: 300` and aggregate `cantidad: 30`
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** each of the 3 items MUST have a `gastoProporcional` value
- **AND** the sum of the 3 `gastoProporcional` values MUST equal `300` within a tolerance of `0.01`
- **AND** the items MUST each receive `gastoProporcional = 100` (since all quantities are equal)

#### Scenario: Proportional expense is prorated by unequal quantities within the same document
- **GIVEN** a product with 2 purchase items from the same `compraDocumento`: one with `cantidad: 10` and another with `cantidad: 20`
- **AND** the document's `GastoCompra` has `total: 300` and `cantidad: 30`
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the item with `cantidad: 10` MUST have `gastoProporcional = 100`
- **AND** the item with `cantidad: 20` MUST have `gastoProporcional = 200`
- **AND** the sum of the 2 `gastoProporcional` values MUST equal `300` within a tolerance of `0.01`

#### Scenario: Per-supplier summary groups items correctly
- **GIVEN** a product with 4 purchase items: 3 from "Proveedor A" (with their `totalLinea` values) AND 1 from "Proveedor B" (with its `totalLinea`)
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the response MUST include a `proveedores` array with exactly 2 entries
- **AND** the entry for Proveedor A MUST report `cantidadTotal` equal to the sum of the 3 items' `cantidad` values
- **AND** the entry for Proveedor A MUST report `montoTotal` equal to the sum of the 3 items' `totalLinea` values
- **AND** the entry for Proveedor B MUST report `cantidadTotal` equal to its single item's `cantidad`
- **AND** the entry for Proveedor B MUST report `montoTotal` equal to its single item's `totalLinea`
- **AND** the sum of `participacionPorcentaje` across all providers MUST equal `100` within a tolerance of `0.1`

#### Scenario: Product with no purchases returns empty payload and SIN_DATOS state
- **GIVEN** a valid product of the current tenant that has zero `CompraDocumentoItem` records associated
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the response MUST succeed (`success: true`)
- **AND** the response MUST contain `items: []`
- **AND** the response MUST contain `proveedores: []`
- **AND** the response MUST contain `estadoCPP: 'SIN_DATOS'`
- **AND** the response MUST contain `advertencias: []`
- **AND** the response MUST NOT return an error

#### Scenario: Items without associated expense report proportional expense as zero
- **GIVEN** a product with purchase items whose source `compraDocumento` has no `GastoCompra` associated (i.e., `gastoCompraId` is `null` for every item or the document's id is absent from the expenses query)
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** every item MUST have `gastoProporcional: 0`
- **AND** the response MUST NOT include an `error` field

### Requirement: estadoCPP computed by the Server Action
The system SHALL compute an `estadoCPP` field for every successful response based on the presence of items in the window and the presence of `advertencias`.

#### Scenario: CALCULADO when items are in window and there are no warnings
- **GIVEN** a product with at least one purchase item whose `fecha` falls within the 12-month window
- **AND** the reconciler produced an empty `advertencias` array
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the response MUST contain `estadoCPP: 'CALCULADO'`

#### Scenario: CON_ADVERTENCIAS when items are in window but warnings exist
- **GIVEN** a product with at least one purchase item within the 12-month window
- **AND** the reconciler produced one or more entries in `advertencias` (e.g., approximate exchange rate, partial expense)
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the response MUST contain `estadoCPP: 'CON_ADVERTENCIAS'`
- **AND** the response MUST include the non-empty `advertencias` array

#### Scenario: SIN_DATOS when no items fall in the window
- **GIVEN** a product whose purchase items all have `fecha` older than the 12-month window
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** the response MUST contain `estadoCPP: 'SIN_DATOS'`
- **AND** every item MUST have `enVentanaCPP: false`

### Requirement: Multi-tenant isolation
The system MUST require an authenticated session AND enforce tenant scoping before returning any reconciled data, and MUST treat any cross-tenant or non-existent product access as `NOT_FOUND` without leaking existence.

#### Scenario: Cross-tenant access is rejected with NOT_FOUND
- **GIVEN** a product that belongs to tenant B
- **WHEN** a user from tenant A calls `getHistorialReconciliadoAction({ productoId })`
- **THEN** the response MUST indicate failure (`success: false`)
- **AND** the response MUST contain `error.code = 'NOT_FOUND'`
- **AND** the response MUST NOT contain any item, expense, or supplier information from tenant B
- **AND** the response MUST NOT reveal whether the product exists in another tenant

#### Scenario: Non-existent product returns NOT_FOUND
- **GIVEN** a `productoId` that does not exist in the current tenant
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called by an authenticated user
- **THEN** the response MUST indicate failure (`success: false`)
- **AND** the response MUST contain `error.code = 'NOT_FOUND'`

#### Scenario: Unauthenticated call is rejected
- **GIVEN** no authenticated session (no user available to the action)
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is invoked
- **THEN** the response MUST indicate failure with an authentication error code (e.g., `UNAUTHENTICATED`)

### Requirement: Response shape contract
The system SHALL return a response object whose shape includes at minimum the fields `items`, `proveedores`, `estadoCPP`, `ventana`, `advertencias`, and the totals `totalCantidadEnVentana` and `totalMontoEnVentana`.

#### Scenario: Response always includes ventana and totals
- **GIVEN** any valid call to `getHistorialReconciliadoAction` (whether the product has purchases or not)
- **WHEN** the action returns successfully
- **THEN** the response MUST include a `ventana` object with `meses`, `desde` and `hasta` fields
- **AND** the response MUST include `totalCantidadEnVentana` and `totalMontoEnVentana` as numeric totals over the items with `enVentanaCPP: true`

#### Scenario: Numeric invariant for proportional expense
- **GIVEN** a product with N items in the 12-month window whose documents have associated `GastoCompra` records
- **WHEN** `getHistorialReconciliadoAction({ productoId })` is called
- **THEN** for every distinct `compraDocumento` in the window, the sum of `gastoProporcional` of its items MUST equal the document's `GastoCompra.total` within a tolerance of `0.01`
