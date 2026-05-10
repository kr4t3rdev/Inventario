# Unidades CRUD Specification (Modified)

## Purpose

Consolidate Unidades CRUD operations to use Zod-validated inputs consistently across REST handlers and Server Actions. Add PUT method for full resource replacement. Ensure HTTP semantics align with REST standards.

## ADDED Requirements

### Requirement: PUT Method for Full Resource Replacement

The system MUST support PUT /unidades/{id} for full resource replacement (all fields required) distinct from PATCH (partial update).

#### Scenario: PUT replaces entire resource

- GIVEN unidad exists with { id: "1", nombre: "Kilogramo", simbolo: "kg" }
- WHEN PUT /unidades/1 with payload { nombre: "Metro", simbolo: "m" } is called
- THEN unidad is replaced entirely (nombre → "Metro", simbolo → "m")
- AND response is 200 { unidadId: "1", nombre: "Metro", simbolo: "m", ... }

#### Scenario: PUT with missing required field fails

- GIVEN PUT /unidades/1 with payload { nombre: "Metro" } (missing simbolo)
- WHEN handler validates
- THEN Zod parse fails (both fields required)
- AND returns 400 { error: "simbolo is required" }

#### Scenario: PUT on non-existent unidad

- GIVEN PUT /unidades/nonexistent with valid payload
- WHEN handler executes
- THEN Prisma update throws (no matching record)
- AND returns 404 { error: "Unidad no encontrada" }

### Requirement: REST HTTP Semantics

The system MUST use correct HTTP methods and status codes for each operation:
- GET: 200 on success, 404 if not found, 500 on error
- POST: 201 (created) on success, 400 validation error, 500 server error
- PUT: 200 on success, 400 validation error, 404 not found, 500 server error
- PATCH: 200 on success, 400 validation error, 404 not found, 500 server error
- DELETE: 204 (no content) on success, 404 if not found, 500 server error

#### Scenario: POST returns 201 Created

- GIVEN valid POST /unidades payload
- WHEN handler creates successfully
- THEN response status is 201 (not 200)

#### Scenario: DELETE returns 204 No Content

- GIVEN valid DELETE /unidades/1 and unidad exists
- WHEN handler deletes successfully
- THEN response status is 204 with empty body (not 200)

#### Scenario: GET returns 404 when not found

- GIVEN GET /unidades/nonexistent
- WHEN handler queries
- THEN response status is 404 (not 500 or 200)

## MODIFIED Requirements

### Requirement: Consistent Validation Across All CRUD Operations (Previously: validation was either present in Server Actions only or absent from REST handlers)

The system MUST validate all CRUD inputs using Zod schemas before any Prisma query, regardless of whether called via API handler or Server Action.

#### Scenario: CREATE via API validates nome and simbolo

- GIVEN POST /unidades with payload { nombre: "k", simbolo: "" }
- WHEN handler parses with `unidadSchema.parse(input)`
- THEN Zod rejects (simbolo is empty)
- AND returns 400 with validation error (no Prisma.create call)

#### Scenario: CREATE via Server Action validates identically

- GIVEN `createUnidadAction({ nombre: "k", simbolo: "" })`
- WHEN action calls `unidadSchema.parse(input)`
- THEN both API and Server Action paths enforce same constraints

#### Scenario: UPDATE via API validates optional fields

- GIVEN PATCH /unidades/1 with payload { nombre: "x" } (symbolo omitted but valid for partial update)
- WHEN handler parses with `unidadUpdateSchema.parse(input)`
- THEN Zod allows partial update (both fields optional in PATCH)

### Requirement: Unified Error Response Format Across All CRUD Methods (Previously: error messages inconsistent—some English, some Spanish)

The system MUST return consistent error structure for all CRUD operations: `{ error: string, details?: ErrorDetail[] }` with appropriate HTTP status codes.

#### Scenario: Validation error response (400)

- GIVEN invalid PATCH payload { nombre: "x".repeat(101) }
- WHEN handler validates
- THEN response: `{ error: "Validation failed", details: [{ field: "nombre", message: "max 100 chars" }] }` with 400

#### Scenario: Not found error response (404)

- GIVEN PATCH /unidades/nonexistent or DELETE /unidades/nonexistent
- WHEN handler checks existence
- THEN response: `{ error: "Unidad no encontrada" }` with 404 (no details array needed)

#### Scenario: Server error response (500)

- GIVEN Prisma throws unexpected error (e.g., database connection lost)
- WHEN handler catches
- THEN response: `{ error: "Database operation failed" }` with 500 (no details array)

### Requirement: DELETE Operation HTTP 204 Response (Previously: deleted successfully but returned 200 with JSON body)

The system MUST return HTTP 204 No Content for successful DELETE operations.

#### Scenario: DELETE returns 204 with empty body

- GIVEN DELETE /unidades/1 and unidad exists
- WHEN handler deletes successfully
- THEN response status 204 (not 200)
- AND response body is empty (not { success: true, id })

### Requirement: Uniqueness Constraint Enforcement on POST (Create)

The system MUST prevent creation of Unidades with duplicate `nombre` or `simbolo` values. These fields are globally unique.

#### Scenario: POST /unidades fails with duplicate nombre

- GIVEN a unidad exists with nombre "Kilogramo"
- WHEN POST /unidades with payload { nombre: "Kilogramo", simbolo: "kg2" } is called
- THEN the handler checks for existing nombre
- AND returns 409 Conflict { error: "Unidad with nombre 'Kilogramo' already exists", field: "nombre" }
- AND no Prisma.create() is executed

#### Scenario: POST /unidades fails with duplicate simbolo

- GIVEN a unidad exists with simbolo "kg"
- WHEN POST /unidades with payload { nombre: "Kilogram", simbolo: "kg" } is called
- THEN the handler checks for existing simbolo
- AND returns 409 Conflict { error: "Unidad with simbolo 'kg' already exists", field: "simbolo" }
- AND no Prisma.create() is executed

#### Scenario: POST /unidades succeeds with unique nombre and simbolo

- GIVEN no unidad exists with nombre "Metro" or simbolo "m"
- WHEN POST /unidades with payload { nombre: "Metro", simbolo: "m" } is called
- THEN handler validates uniqueness passes
- AND creates unidad successfully (201)

### Requirement: Uniqueness Constraint Enforcement on PUT (Full Replace)

The system MUST prevent PUT operations that would result in duplicate `nombre` or `simbolo` values for OTHER records.

#### Scenario: PUT /unidades/{id} fails if new nombre conflicts with another record

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- GIVEN unidad 2 has { nombre: "Gramo", simbolo: "g" }
- WHEN PUT /unidades/2 with payload { nombre: "Kilogramo", simbolo: "m" } is called
- THEN handler validates nombre uniqueness (excluding current record id=2)
- AND returns 409 Conflict { error: "Unidad with nombre 'Kilogramo' already exists", field: "nombre" }
- AND no Prisma.update() is executed

#### Scenario: PUT /unidades/{id} fails if new simbolo conflicts with another record

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- GIVEN unidad 2 has { nombre: "Litro", simbolo: "l" }
- WHEN PUT /unidades/2 with payload { nombre: "Liter", simbolo: "kg" } is called
- THEN handler validates simbolo uniqueness (excluding current record id=2)
- AND returns 409 Conflict { error: "Unidad with simbolo 'kg' already exists", field: "simbolo" }

#### Scenario: PUT /unidades/{id} succeeds by updating to unique values

- GIVEN unidad 2 has { nombre: "Litro", simbolo: "l" }
- WHEN PUT /unidades/2 with payload { nombre: "Liter", simbolo: "lt" } is called (both unique)
- THEN handler validates both fields are unique
- AND replaces the record successfully (200)

#### Scenario: PUT /unidades/{id} succeeds when keeping same nombre and simbolo (self-update)

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- WHEN PUT /unidades/1 with payload { nombre: "Kilogramo", simbolo: "kg" } (same values) is called
- THEN handler correctly excludes current record from uniqueness check
- AND allows self-update to succeed (200)

### Requirement: Uniqueness Constraint Enforcement on PATCH (Partial Update)

The system MUST prevent PATCH operations that would result in duplicate `nombre` or `simbolo` values for OTHER records when those fields are provided.

#### Scenario: PATCH /unidades/{id} fails if new nombre would conflict

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- GIVEN unidad 2 has { nombre: "Gramo", simbolo: "g" }
- WHEN PATCH /unidades/2 with payload { nombre: "Kilogramo" } is called
- THEN handler validates nombre uniqueness (excluding current record)
- AND returns 409 Conflict { error: "Unidad with nombre 'Kilogramo' already exists", field: "nombre" }

#### Scenario: PATCH /unidades/{id} fails if new simbolo would conflict

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- GIVEN unidad 2 has { nombre: "Gramo", simbolo: "g" }
- WHEN PATCH /unidades/2 with payload { simbolo: "kg" } is called
- THEN handler validates simbolo uniqueness (excluding current record)
- AND returns 409 Conflict { error: "Unidad with simbolo 'kg' already exists", field: "simbolo" }

#### Scenario: PATCH /unidades/{id} succeeds when updating non-conflicting fields

- GIVEN unidad 2 has { nombre: "Gramo", simbolo: "g" }
- WHEN PATCH /unidades/2 with payload { nombre: "Gram" } is called (new unique nombre)
- THEN handler validates uniqueness passes
- AND updates the record successfully (200)

#### Scenario: PATCH /unidades/{id} succeeds when omitting conflicting fields

- GIVEN unidad 1 has { nombre: "Kilogramo", simbolo: "kg" }
- GIVEN unidad 2 has { nombre: "Gramo", simbolo: "g" }
- WHEN PATCH /unidades/2 with payload { extra_field: "value" } (neither nombre nor simbolo) is called
- THEN handler skips uniqueness validation for omitted fields
- AND updates non-unique fields successfully (200)

## Success Criteria

- [ ] PUT method implemented on /unidades/{id} requiring all CRUD fields
- [ ] POST returns 201 (created) on success, not 200
- [ ] DELETE returns 204 (no content) on success, not 200
- [ ] All CRUD operations use HTTP 400/404/500 semantically correct
- [ ] All validation happens before Prisma calls
- [ ] Error response format consistent across all methods: `{ error, details? }`
- [ ] Both API handlers and Server Actions use same Zod schemas
- [ ] PATCH allows partial updates (fields optional), PUT requires all fields
- [ ] Unidad retrieved after operation and returned to client (GET returns full resource)
- [ ] revalidatePath('/busy/unidad') called after successful mutations (CREATE/UPDATE/DELETE)
- [ ] No breaking changes: existing consumers continue working (response shape compatible)
- [ ] **Uniqueness enforcement**: nombre and simbolo are checked for duplicates on POST/PUT/PATCH
- [ ] **Conflict handling**: HTTP 409 returned with `{ error, field }` identifying duplicate field
- [ ] **Uniqueness scope**: Global (across all Unidades), excluding self on UPDATE operations
- [ ] **Pre-Prisma check**: Uniqueness validation occurs before any Prisma operation, not relying on DB constraint exceptions
