# Spec: Bulk Percentage Action

## ADDED Requirements

### Requirement: Bulk Percentage Price Adjustment

The system SHALL provide `bulkApplyPercentageAction` that, when invoked by a manager, applies a percentage delta (`porcentaje`) to `precioVenta` for every selected product belonging to the caller's tenant, records an audit row per updated product, and returns a structured result that distinguishes updated, skipped, and failed products.

#### Scenario: Apply positive percentage to a batch of products

- **GIVEN** a manager authenticated in tenant `T1` with feature `ficha-costo-precios-masivo` enabled
- **AND** three products `[p1, p2, p3]` exist in tenant `T1` with `precioVenta` `[100, 200, 50]`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: ['p1','p2','p3'], tenantId: 'T1' })`
- **THEN** the returned `updated` is `3` and `errors` is `[]`
- **AND** `results` contains one entry per product with `oldPrecio` matching the previous value and `newPrecio` equal to `Math.round(oldPrecio * 1.10)` (i.e. `[110, 220, 55]`)
- **AND** three `ProductoCostHistory` rows are written with `CostChangeReason.ADJUSTMENT` and `tenantId = 'T1'`

#### Scenario: Apply negative percentage (price decrease)

- **GIVEN** a manager in tenant `T1` with one product having `precioVenta = 200`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: -25, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the product's new `precioVenta` is `150` (rounded from `200 * 0.75`)
- **AND** one `ProductoCostHistory` row is written with `CostChangeReason.ADJUSTMENT`

#### Scenario: Reject products that belong to another tenant

- **GIVEN** a manager in tenant `T1`
- **AND** `p1` belongs to `T1` and `pX` belongs to tenant `T2`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: ['p1','pX'], tenantId: 'T1' })`
- **THEN** `p1` is updated successfully
- **AND** `pX` appears in `errors` with code `NOT_FOUND` and a message indicating the product does not belong to the caller's tenant
- **AND** `updated = 1` and `errors.length = 1`
- **AND** no `ProductoCostHistory` row is written for `pX`

#### Scenario: Reject non-manager callers

- **GIVEN** an authenticated user in tenant `T1` whose role is NOT manager
- **AND** one product exists in `T1`
- **WHEN** the user calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the action throws `ActionError` with code `FORBIDDEN`
- **AND** the product is NOT updated
- **AND** no `ProductoCostHistory` row is written

#### Scenario: Reject percentage equal to zero

- **GIVEN** a manager in tenant `T1` with one product
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 0, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the action throws a validation error (Zod `porcentaje` must be strictly greater than 0)
- **AND** the product is NOT updated

#### Scenario: Reject percentage above the upper bound

- **GIVEN** a manager in tenant `T1` with one product
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 1000, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the action throws a validation error (Zod `porcentaje` must be strictly less than 1000)
- **AND** the product is NOT updated

#### Scenario: Accept percentage at the upper bound (exclusive)

- **GIVEN** a manager in tenant `T1` with one product priced at `100`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 999.99, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the action succeeds and the new `precioVenta` is `Math.round(100 * (1 + 999.99/100))`

#### Scenario: Empty selection is a no-op

- **GIVEN** a manager in tenant `T1`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: [], tenantId: 'T1' })`
- **THEN** the action returns `{ updated: 0, skipped: 0, errors: [], results: [] }` without throwing
- **AND** no `ProductoCostHistory` row is written

#### Scenario: Partial failure does not abort the batch

- **GIVEN** a manager in tenant `T1` with products `p1, p2, p3`
- **AND** `p2` is in a state that causes the `update` to fail (e.g. concurrent delete)
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: ['p1','p2','p3'], tenantId: 'T1' })`
- **THEN** `p1` and `p3` are updated
- **AND** `p2` appears in `errors` with a descriptive message
- **AND** `updated = 2` and `errors.length = 1`
- **AND** the action does NOT throw — partial success is reported, not raised

#### Scenario: Batch larger than 50 products is chunked

- **GIVEN** a manager in tenant `T1` with 120 products
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 5, productoIds: <120 ids>, tenantId: 'T1' })`
- **THEN** the system processes the products in chunks of at most 50 per `$transaction` (i.e. 3 chunks: 50 + 50 + 20)
- **AND** a single `ProductoCostHistory` row is written per updated product (120 total when all succeed)
- **AND** the final result aggregates `updated`, `errors`, and `results` across all chunks

#### Scenario: Rounding uses half-away-from-zero at the product level

- **GIVEN** a manager in tenant `T1` with one product priced at `100`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 12.5, productoIds: ['p1'], tenantId: 'T1' })`
- **THEN** the new `precioVenta` is `Math.round(100 * 1.125)` (i.e. `113`), with no floating-point drift propagated to the persisted value

#### Scenario: Tenant mismatch in the payload is ignored

- **GIVEN** a manager in tenant `T1`
- **WHEN** the manager calls `bulkApplyPercentageAction({ porcentaje: 10, productoIds: ['p1'], tenantId: 'T2' })` (payload `tenantId` differs from the caller's session)
- **THEN** the action uses the caller's `tenantId` (from session) for every `where` and every history row, NOT the value passed in the payload
- **AND** no cross-tenant data is exposed
