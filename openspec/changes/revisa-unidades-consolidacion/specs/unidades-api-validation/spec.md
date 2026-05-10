# Unidades API Validation Specification

## Purpose

Ensure all REST API operations (GET, POST, PUT, PATCH, DELETE) validate input through Zod schemas before executing Prisma queries. Currently, API handlers parse `request.json()` directly without validation, bypassing security checks present in Server Actions.

## ADDED Requirements

### Requirement: Centralized Input Validation

The system MUST validate all REST API payloads using Zod schemas exported from `src/features/unidades/schemas.ts` before any database operation.

#### Scenario: POST /unidades with valid payload

- GIVEN a valid JSON payload `{ nombre: "Kilogramo", simbolo: "kg" }`
- WHEN POST /unidades is called
- THEN the handler parses with `unidadSchema.parse(input)`
- AND creates the unidad on success (201)

#### Scenario: POST /unidades with invalid payload (missing nombre)

- GIVEN a JSON payload `{ simbolo: "kg" }`
- WHEN POST /unidades is called
- THEN Zod parse fails with validation error
- AND returns 400 { errors: [...] } immediately (no Prisma call)

#### Scenario: POST /unidades with oversized nombre

- GIVEN a JSON payload `{ nombre: "x".repeat(101), simbolo: "kg" }`
- WHEN POST /unidades is called
- THEN Zod parse catches max length violation
- AND returns 400 with specific error message

### Requirement: Unified Error Response Format

The system MUST return consistent error responses across all validation failures with status 400 and structured error details.

#### Scenario: Validation error response shape

- GIVEN any invalid input (missing field, wrong type, constraint violation)
- WHEN handler validates
- THEN response is `{ error: "Validation failed", details: [...] }` with HTTP 400

#### Scenario: Database error distinction (NOT validation)

- GIVEN valid input but Prisma throws (e.g., duplicate constraint)
- WHEN handler executes
- THEN returns 500 with `{ error: "Database operation failed" }` (not 400)

### Requirement: Zod Schema Export and Reusability

The system MUST export pagination and CRUD validation schemas from a centralized location so API handlers can import and reuse them.

#### Scenario: Import schemas in handlers

- GIVEN handlers.ts needs to validate
- WHEN it imports `{ unidadSchema, unidadUpdateSchema, paginationSchema }` from handlers file
- THEN all three schemas are available without duplication

#### Scenario: No inline schemas in handlers

- GIVEN openspec rules prefer centralized validation
- WHEN handlers.ts is implemented
- THEN no Zod object definitions exist in handlers.ts itself (all imported)

### Requirement: Uniqueness Constraint Validation for nombre and simbolo

The system MUST validate that `nombre` and `simbolo` fields are globally unique across all Unidades records. These fields MUST NOT contain duplicates in the database.

#### Scenario: POST /unidades with duplicate nombre

- GIVEN a unidad already exists with nombre "Kilogramo"
- WHEN POST /unidades with payload { nombre: "Kilogramo", simbolo: "kg2" } is called
- THEN the handler validates uniqueness before Prisma create
- AND returns 409 Conflict { error: "Unidad with nombre 'Kilogramo' already exists", field: "nombre" }

#### Scenario: POST /unidades with duplicate simbolo

- GIVEN a unidad already exists with simbolo "kg"
- WHEN POST /unidades with payload { nombre: "Kilogram", simbolo: "kg" } is called
- THEN the handler validates uniqueness before Prisma create
- AND returns 409 Conflict { error: "Unidad with simbolo 'kg' already exists", field: "simbolo" }

#### Scenario: POST /unidades with unique nombre and simbolo succeeds

- GIVEN unique values nombre: "Metro", simbolo: "m"
- WHEN POST /unidades with valid unique payload is called
- THEN the handler validates both fields are unique
- AND creates the unidad successfully (201)

#### Scenario: Uniqueness check is case-sensitive for database storage but case-insensitive for detection

- GIVEN a unidad exists with nombre "Kilogramo" (capital K)
- WHEN POST /unidades with payload { nombre: "kilogramo", simbolo: "kg2" } is called
- THEN uniqueness validation compares case-sensitively OR flags as collision based on business rules
- AND returns 409 Conflict if considered duplicate

## MODIFIED Requirements

_None—this is a new capability. Existing Server Actions remain unchanged._

## Success Criteria

- [ ] All API handlers import and use Zod schemas for input validation
- [ ] Validation errors return HTTP 400 with structured `{ error, details }` response
- [ ] Database errors return HTTP 500 (never 400)
- [ ] No direct `request.json()` without Zod parse in handlers
- [ ] Schemas are defined once in `schemas.ts` or `validators.ts`, not duplicated in handlers
- [ ] Existing Server Actions continue unchanged (no integration required for this spec alone)
- [ ] **Uniqueness validation**: nombre and simbolo are checked for duplicates before Prisma create/update
- [ ] **Conflict response**: HTTP 409 Conflict with `{ error, field }` for duplicate detection
- [ ] **Uniqueness check location**: Validation occurs in Zod schema OR in handler before Prisma (not relying on DB unique constraint alone)
