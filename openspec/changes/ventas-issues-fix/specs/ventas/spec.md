# Delta for Ventas API

## Purpose

Fix 5 critical issues in the Ventas system: MultiTenant isolation, Idempotency protection, Stock unification, Location validation, and Error handling.

## ADDED Requirements

### Requirement: MultiTenant Scope in All Handlers

ALL venta handlers SHALL use `requireTenant(user)` instead of hardcoded `tenantId: ''`.

The handlers affected are:
- `createVentaHandler`
- `getVentaByIdHandler`
- `updateVentaHandler`
- `deleteVentaHandler`
- `getVentasStatsHandler`

When a user without an active tenant membership attempts an operation, the system MUST return HTTP 403 with error "Se requiere una membresía de empresa activa para acceder a este recurso".

#### Scenario: Create venta with valid tenant

- GIVEN an authenticated user with an active empresa membership
- WHEN the user creates a venta
- THEN the venta is created with the user's `tenantId`
- AND `tenantId` is NOT empty string

#### Scenario: Create venta without tenant membership

- GIVEN an authenticated user WITHOUT an active empresa membership
- WHEN the user attempts to create a venta
- THEN the API returns HTTP 403
- AND no venta is created

#### Scenario: Update/delete/review venta from other tenant

- GIVEN a venta belongs to tenant-A
- AND the user belongs to tenant-B
- WHEN the user attempts to get/update/delete that venta
- THEN the API returns HTTP 404 (resource not visible)

### Requirement: Idempotency Key Support

The API SHALL support optional `idempotencyKey` (UUID) in create requests.

When an `idempotencyKey` is provided AND a matching venta already exists, the system MUST return the existing venta (HTTP 200) instead of creating a duplicate.

When no `idempotencyKey` is provided, the system MUST auto-generate one (UUID v4).

#### Scenario: Create venta with idempotencyKey (new)

- GIVEN a venta does NOT exist with the given `idempotencyKey`
- WHEN the client creates a venta with `idempotencyKey`
- THEN the venta is created with HTTP 201
- AND the `idempotencyKey` is stored

#### Scenario: Retry with same idempotencyKey (idempotent)

- GIVEN a venta already exists with the given `idempotencyKey`
- WHEN the client sends the same create request again
- THEN the API returns HTTP 200
- AND the existing venta is returned
- AND no duplicate is created

#### Scenario: Create venta without idempotencyKey (backward compat)

- GIVEN no `idempotencyKey` is provided in the request
- WHEN the client creates a venta
- THEN the venta is created with HTTP 201
- AND a UUID is auto-generated as `idempotencyKey`

### Requirement: Stock Unification

Stock calculation SHALL use ONLY `VentaItem` records. The legacy `ventasLegacy` aggregate (sum of `Venta.productoId` + `Venta.cantidad`) SHALL be removed.

#### Scenario: Stock reflects VentaItem only

- GIVEN a product has sales recorded ONLY via `VentaItem`
- WHEN stock is calculated
- THEN the stock deduction matches the sum of `VentaItem.cantidad`

#### Scenario: Legacy fields ignored in stock

- GIVEN a product has legacy `Venta.productoId` and `Venta.cantidad` fields
- WHEN stock is calculated
- THEN these legacy fields are NOT included in the deduction

### Requirement: Location Validation Before Transaction

The API SHALL validate that `puntoDeVentaId` and `almacenId` exist before creating a venta.

#### Scenario: Valid locations

- GIVEN valid `puntoDeVentaId` and `almacenId` that exist in their tables
- WHEN the client creates a venta
- THEN the venta is created successfully

#### Scenario: Invalid puntoDeVentaId

- GIVEN a `puntoDeVentaId` that does NOT exist
- WHEN the client creates a venta with this ID
- THEN the API returns HTTP 400
- AND error indicates invalid punto de venta

#### Scenario: Invalid almacenId

- GIVEN an `almacenId` that does NOT exist
- WHEN the client creates a venta with this ID
- THEN the API returns HTTP 400
- AND error indicates invalid almacén

### Requirement: Structured Error Handling

All venta handlers SHALL use `withVentaTransaction` wrapper that:
1. Logs `[VENTA_TX_ROLLBACK]` context on failure
2. Returns structured error responses
3. Discriminates Prisma error codes:
   - P2002 (unique constraint) → HTTP 409
   - P2025 (not found) → HTTP 404
   - Other → HTTP 500

#### Scenario: Prisma unique constraint violation

- GIVEN a request violates a unique constraint
- WHEN the handler processes it
- THEN the API returns HTTP 409
- AND error indicates duplicate/conflict

#### Scenario: Prisma not found

- GIVEN a requested resource does not exist
- WHEN the handler attempts to access it
- THEN the API returns HTTP 404
- AND error indicates "no encontrado"

#### Scenario: Generic error

- GIVEN an unexpected database error
- WHEN the handler processes the request
- THEN the API returns HTTP 500
- AND `[VENTA_TX_ROLLBACK]` is logged with context
