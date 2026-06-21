# Ficha de Costo — Plantilla CRUD

## Purpose

Especificación para la creación, lectura, actualización, versionado y eliminación de plantillas de ficha de costo por producto.

## Requirements

### Requirement: Crear plantilla de ficha de costo

The system MUST allow creating a new cost-sheet template for a product, automatically assigning the next sequential version number.

#### Scenario: Crear primera plantilla para un producto simple

- GIVEN a product `P` with `productoId` exists and has no existing templates
- WHEN a user with permission creates a template for `P` with `materiales: []`, `manoObra: 0`, `indirectos: 0`, `margenObjetivo: 0.30`
- THEN the system MUST create a `ProductoCostSheetTemplate` record with `version: 1`
- AND the `costoTotal` MUST equal `0`
- AND the `precioSugerido` MUST equal `0`
- AND `esActiva` MUST default to `false`
- AND the `tenantId` of the template MUST match the product's `tenantId`

#### Scenario: Crear plantilla para producto compuesto con materiales, mano de obra e indirectos

- GIVEN a product `P` exists and has `n` existing templates
- WHEN a user creates a template with `materiales: [{productoId: "M1", cantidad: 2, costoUnitario: 5.00}]`, `manoObra: 10.00`, `indirectos: 3.50`, `margenObjetivo: 0.25`
- THEN the system MUST create the template with `version: n + 1`
- AND `costoTotal` MUST equal `(2 * 5.00) + 10.00 + 3.50 = 23.50`
- AND `precioSugerido` MUST equal `23.50 / (1 - 0.25) = 31.33` (rounded to 2 decimals)
- AND `esActiva` MUST be `false`

### Requirement: Activar versión de plantilla

The system MUST ensure exactly one active template per product by automatically deactivating the previously active version when a new one is activated.

#### Scenario: Activar una versión desactiva la anterior automáticamente

- GIVEN product `P` has an active template `T1` with `version: 1` and `esActiva: true`
- AND product `P` has another template `T2` with `version: 2` and `esActiva: false`
- WHEN a user activates `T2`
- THEN the system MUST set `T2.esActiva = true`
- AND the system MUST set `T1.esActiva = false`
- AND the operation MUST be atomic (transactional)

#### Scenario: Activar la única versión existente

- GIVEN product `P` has exactly one template `T1` with `esActiva: false`
- WHEN a user activates `T1`
- THEN the system MUST set `T1.esActiva = true`
- AND no other templates for `P` exist to deactivate

### Requirement: Listar versiones de plantilla

The system MUST allow listing all templates for a product, ordered by version descending.

#### Scenario: Listar versiones de plantilla de un producto

- GIVEN product `P` has templates `T1` (version 1, active), `T2` (version 2, inactive), `T3` (version 3, inactive)
- WHEN a user requests the template list for `P`
- THEN the system MUST return `[T3, T2, T1]` ordered by `version DESC`
- AND each item MUST include `templateId`, `version`, `esActiva`, `costoTotal`, `precioSugerido`, `createdAt`, `createdBy`

#### Scenario: Listar versiones para producto sin plantillas

- GIVEN product `P` has no templates
- WHEN a user requests the template list for `P`
- THEN the system MUST return an empty array `[]`

### Requirement: Actualizar plantilla existente

The system SHOULD allow updating non-critical fields of an inactive template.

#### Scenario: Actualizar notas de una plantilla existente

- GIVEN template `T` with `version: 2` and `notas: "Versión inicial"` exists
- AND `T.esActiva` is `false`
- WHEN a user updates `T.notas` to `"Ajustado por inflación Q2"`
- THEN the system MUST persist the updated `notas` value
- AND `version`, `costoTotal`, `precioSugerido`, and `esActiva` MUST remain unchanged

#### Scenario: Intentar actualizar campos calculados de una plantilla

- GIVEN template `T` exists with `costoTotal: 100.00`
- WHEN a user attempts to directly update `costoTotal` to `150.00`
- THEN the system MUST reject the update
- AND return an error indicating that calculated fields cannot be modified directly

### Requirement: Eliminar plantilla

The system MUST support soft-delete for templates, but MUST prevent deletion of the active template.

#### Scenario: Eliminar una plantilla no activa (soft-delete)

- GIVEN template `T` with `esActiva: false` exists
- WHEN a user with permission requests deletion of `T`
- THEN the system MUST perform a soft-delete (e.g., set `deletedAt` or `esBorrado: true`)
- AND the template MUST no longer appear in standard list queries

#### Scenario: Intentar eliminar la plantilla activa

- GIVEN template `T` with `esActiva: true` exists
- WHEN a user requests deletion of `T`
- THEN the system MUST reject the operation
- AND return an error with code `CANNOT_DELETE_ACTIVE_TEMPLATE`
- AND `T` MUST remain active and undeleted

### Requirement: Aislamiento multi-tenant

The system MUST enforce strict tenant isolation for all template operations.

#### Scenario: Producto de otro tenant → NOT_FOUND

- GIVEN product `P` belongs to `tenant-A`
- AND the authenticated user belongs to `tenant-B`
- WHEN the user attempts to create, read, update, delete, or activate a template for `P`
- THEN the system MUST return a `NOT_FOUND` error (or equivalent 404 response)
- AND MUST NOT leak the existence of `P` to the user

## Non-Functional Requirements

- Template activation MUST be executed within a database transaction to prevent race conditions.
- All queries MUST filter by `tenantId` to enforce multi-tenant isolation.
- Soft-delete MUST be used instead of hard-delete to preserve audit history.
- Version numbers MUST be sequential integers without gaps under normal operation.
