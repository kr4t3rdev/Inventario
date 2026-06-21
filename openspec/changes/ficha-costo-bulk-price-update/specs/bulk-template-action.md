# Spec: Bulk Template Action

## ADDED Requirements

### Requirement: Bulk Apply Cost Sheet Template

The system SHALL provide `bulkApplyTemplateAction` that, when invoked by a manager, applies the price suggested by a Cost Sheet Template to every selected product that has an active `plantillaActiva` in the caller's tenant, records an audit row per updated product, and returns a structured result where products without an active template are reported as `skipped` (not as errors).

#### Scenario: Apply template to products that have an active template

- **GIVEN** a manager in tenant `T1` with feature `ficha-costo-precios-masivo` enabled
- **AND** `plantillaId` points to a Cost Sheet Template `TPL` with `precioSugerido = 150` and `version = 3`
- **AND** three products `[p1, p2, p3]` exist in tenant `T1` with `precioVenta` `[100, 200, 50]` and `plantillaActiva = TPL` for all three
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: ['p1','p2','p3'] })`
- **THEN** `updated = 3` and `skipped = 0` and `errors = []`
- **AND** all three products have new `precioVenta = 150` (rounded from `150`)
- **AND** three `ProductoCostHistory` rows are written with `CostChangeReason.MANUAL_EDIT` and `notes = "Plantilla aplicada masivamente"` (template version and template id recorded in the note)

#### Scenario: Skip products without an active template

- **GIVEN** a manager in tenant `T1`
- **AND** `p1` and `p3` have `plantillaActiva = TPL` and `p2` has `plantillaActiva = null`
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: ['p1','p2','p3'] })`
- **THEN** `updated = 2` and `skipped = 1`
- **AND** `p2` is reported in `results` (or an equivalent "skipped" channel) with a message indicating it has no active template — NOT in `errors`
- **AND** no `ProductoCostHistory` row is written for `p2`

#### Scenario: Reject products that belong to another tenant

- **GIVEN** a manager in tenant `T1`
- **AND** `p1` belongs to `T1` and `pX` belongs to tenant `T2`
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: ['p1','pX'] })`
- **THEN** `p1` is processed normally
- **AND** `pX` appears in `errors` with code `NOT_FOUND`
- **AND** no `ProductoCostHistory` row is written for `pX`

#### Scenario: Reject non-manager callers

- **GIVEN** an authenticated user in tenant `T1` whose role is NOT manager
- **WHEN** the user calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: ['p1'] })`
- **THEN** the action throws `ActionError` with code `FORBIDDEN`
- **AND** no product is updated and no history row is written

#### Scenario: Reject empty selection

- **GIVEN** a manager in tenant `T1`
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: [] })`
- **THEN** the action returns `{ updated: 0, skipped: 0, errors: [], results: [] }` without throwing

#### Scenario: Template belongs to another tenant

- **GIVEN** a manager in tenant `T1`
- **AND** `plantillaId` points to a template owned by tenant `T2`
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId, productoIds: ['p1'] })`
- **THEN** the action throws `ActionError` with code `NOT_FOUND` (the template is invisible to this tenant)
- **AND** no product is updated

#### Scenario: Template is loaded once per batch

- **GIVEN** a manager in tenant `T1` calling `bulkApplyTemplateAction` with 100 products
- **WHEN** the action executes
- **THEN** the template is fetched exactly once (per chunk if chunked) and the same `precioSugerido` value is applied to every updated product
- **AND** if the template becomes unavailable mid-batch, the in-flight chunk fails cleanly and remaining chunks are NOT executed

#### Scenario: Partial failure does not abort the batch

- **GIVEN** a manager in tenant `T1` with products `p1, p2, p3`, all with `plantillaActiva = TPL`
- **AND** `p2` is in a state that causes the `update` to fail
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: ['p1','p2','p3'] })`
- **THEN** `p1` and `p3` are updated
- **AND** `p2` appears in `errors` with a descriptive message
- **AND** the action does NOT throw — partial success is reported, not raised

#### Scenario: Batch larger than 50 products is chunked

- **GIVEN** a manager in tenant `T1` with 120 products, all with `plantillaActiva = TPL`
- **WHEN** the manager calls `bulkApplyTemplateAction({ plantillaId: 'TPL', productoIds: <120 ids> })`
- **THEN** the products are processed in chunks of at most 50 per `$transaction` (3 chunks: 50 + 50 + 20)
- **AND** the template `findFirst` is reused across chunks within a single action call (not re-fetched per chunk when already in memory)
- **AND** `ProductoCostHistory` rows are written per updated product
- **AND** the final result aggregates `updated`, `skipped`, `errors`, and `results` across all chunks

#### Scenario: Audit note is descriptive

- **GIVEN** a manager in tenant `T1` applies `TPL` (version `3`) to product `p1`
- **WHEN** the action writes the `ProductoCostHistory` row for `p1`
- **THEN** the `notes` field contains a non-empty string that includes the template identifier (id and/or version) and a clear "masivo" marker so the audit trail is self-explanatory
- **AND** `costChangeReason = MANUAL_EDIT`
- **AND** `userId` is the calling manager
- **AND** `tenantId` is the caller's tenant
