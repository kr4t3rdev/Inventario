# Delta for GastosDE

## MODIFIED Requirements

### Requirement: GastosDE Listing and Filtering

The system MUST display GastosDE records sorted by **creation date descending (newest first)**. Sorting by amount or any other field is non-conformant.

(Previously: the spec said "sorted by date descending (newest first)" but the implementation in `actions.ts:20` used `orderBy: { monto: 'desc' }`. This delta codifies the requirement and rejects the previous implementation as a defect.)

#### Scenario: Default ordering is newest first

- GIVEN there are GastosDE records with distinct `createdAt` timestamps
- WHEN the user calls `getGastosDEAction({})` without filters
- THEN the system MUST return records ordered by `createdAt: 'desc'`
- AND MUST NOT order by `monto` or any other field by default

#### Scenario: Ordering is stable across pages

- GIVEN there are more than 10 GastosDE records
- WHEN the user paginates through the list
- THEN the system MUST preserve the `createdAt: 'desc'` ordering across page boundaries

#### Scenario: Tenant-scoped listing

- GIVEN there are GastosDE records belonging to different tenants
- WHEN the user calls `getGastosDEAction({})` with their authenticated user
- THEN the system MUST return only records where `tenantId` matches the caller's tenant
- AND MUST NOT return records from other tenants regardless of any other filter

### Requirement: GastosDE Editing

The system MUST persist **all editable fields** when an update is submitted. A partial update that silently drops fields is a defect.

(Previously: the spec was silent on which fields the update must persist. This delta tightens the contract: the update must persist every field the form sends, conditional on presence in the payload.)

#### Scenario: Update persists tipo

- GIVEN an existing GastosDE with `tipo = 'Texto anterior'`
- WHEN the user submits an update with `tipo: 'Tipo nuevo'`
- THEN the system MUST persist `tipo = 'Tipo nuevo'`
- AND the updated record MUST be retrievable with the new `tipo`

#### Scenario: Update persists conceptoId

- GIVEN an existing GastosDE with `conceptoId = null`
- WHEN the user submits an update with `conceptoId: 'c-valid-id'`
- THEN the system MUST persist `conceptoId = 'c-valid-id'`
- AND the persisted value MUST be a valid `GastoConcepto.conceptoId` from the same tenant

#### Scenario: Update persists elementoId

- GIVEN an existing GastosDE with `elementoId = null`
- WHEN the user submits an update with `elementoId: 'e-valid-id'` (and a matching `conceptoId`)
- THEN the system MUST persist `elementoId = 'e-valid-id'`
- AND the persisted `elementoId` MUST belong to the same `conceptoId` per the relation

#### Scenario: Update persists periodo

- GIVEN an existing GastosDE with `periodo = '2026-01'`
- WHEN the user submits an update with `periodo: '2026-06'`
- THEN the system MUST persist `periodo = '2026-06'`
- AND the persisted value MUST match the `YYYY-MM` format

#### Scenario: Update rejects mismatched concepto-elemento pair

- GIVEN an existing GastosDE
- WHEN the user submits an update with `conceptoId: 'c1'` and `elementoId: 'e-from-c2'`
- THEN the system MUST reject the update with `VALIDATION_ERROR`
- AND the database state MUST remain unchanged

#### Scenario: Update enforces tenant scope

- GIVEN a GastosDE belonging to tenant `t-A`
- WHEN a user from tenant `t-B` submits an update referencing that record
- THEN the system MUST reject the update with `NOT_FOUND`
- AND the record MUST remain unchanged

#### Scenario: Partial update only touches provided fields

- GIVEN an existing GastosDE with `proveedor: 'P1'`, `monto: 1000`, `descripcion: 'D'`
- WHEN the user submits an update with only `monto: 2000` (no other fields)
- THEN the system MUST persist `monto = 2000`
- AND MUST preserve `proveedor = 'P1'` and `descripcion = 'D'`
- AND MUST NOT clear other fields to null

### Requirement: GastosDE Deletion

#### Scenario: Delete enforces tenant scope

- GIVEN a GastosDE belonging to tenant `t-A`
- WHEN a user from tenant `t-B` attempts to delete that record
- THEN the system MUST reject the deletion with `NOT_FOUND`
- AND the record MUST remain in the database

## ADDED Requirements

### Requirement: Visual summary visibility

The system MUST show the "Resumen del Gasto" panel whenever the form has a `monto` value AND at least one of the following identifiers is present: `tipo`, `conceptoId`, or `elementoId`.

(Previously: the panel was gated by `tipo && monto` only, which incorrectly hid the summary for the valid case of using `conceptoId` + `elementoId` without `tipo`.)

#### Scenario: Summary appears for tipo-only entries

- GIVEN the form has `tipo: 'Arrendamiento'` and `monto: 5000`
- WHEN the user fills the form
- THEN the "Resumen del Gasto" panel MUST be visible

#### Scenario: Summary appears for concepto+elemento entries without tipo

- GIVEN the form has `conceptoId: 'c1'`, `elementoId: 'e1'`, `monto: 5000`, and `tipo: ''`
- WHEN the user fills the form
- THEN the "Resumen del Gasto" panel MUST be visible

#### Scenario: Summary is hidden when no monto

- GIVEN the form has `monto: undefined` and `tipo: 'X'`
- WHEN the user renders the form
- THEN the "Resumen del Gasto" panel MUST NOT be visible

### Requirement: Form code hygiene

The form component MUST NOT contain stray literal text in JSX.

#### Scenario: No accidental literals in form JSX

- GIVEN `src/features/gastosDE/components/GastoDEForm.tsx`
- WHEN `grep -n 'CCZXXZ' src/features/gastosDE/components/GastoDEForm.tsx` is executed
- THEN the command MUST return zero matches
