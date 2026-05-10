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

## MODIFIED Requirements

_None—this is a new capability. Existing Server Actions remain unchanged._

## Success Criteria

- [ ] All API handlers import and use Zod schemas for input validation
- [ ] Validation errors return HTTP 400 with structured `{ error, details }` response
- [ ] Database errors return HTTP 500 (never 400)
- [ ] No direct `request.json()` without Zod parse in handlers
- [ ] Schemas are defined once in `schemas.ts` or `validators.ts`, not duplicated in handlers
- [ ] Existing Server Actions continue unchanged (no integration required for this spec alone)
