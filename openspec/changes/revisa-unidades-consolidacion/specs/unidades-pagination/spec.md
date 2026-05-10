# Unidades Pagination Specification

## Purpose

Implement standardized pagination support on GET /unidades to allow clients to fetch large datasets efficiently without loading all unidades into memory. Support both limit/offset and sortable ordering.

## ADDED Requirements

### Requirement: Limit and Offset Query Parameters

The system MUST accept `?limit={number}&offset={number}` query parameters on GET /unidades and return paginated results accordingly.

#### Scenario: GET /unidades with limit and offset

- GIVEN 100 unidades exist in the database
- WHEN GET /unidades?limit=10&offset=20 is called
- THEN response contains exactly 10 unidades (21-30 by creation order)
- AND response includes `{ items: [...], total: 100, limit: 10, offset: 20 }`

#### Scenario: GET /unidades with no pagination parameters (backward compatible)

- GIVEN pagination parameters are optional
- WHEN GET /unidades is called without ?limit or ?offset
- THEN response returns all unidades (or configurable default limit, e.g., 100)
- AND includes pagination envelope `{ items: [...], total: count }`

#### Scenario: GET /unidades with limit only

- GIVEN only `?limit=15` is provided
- WHEN GET /unidades?limit=15 is called
- THEN offset defaults to 0
- AND response contains first 15 unidades

### Requirement: Sorting and Ordering Parameters

The system MUST support `?orderBy={field}&order={asc|desc}` to sort results by nombre or simbolo.

#### Scenario: Sort by nombre ascending

- GIVEN unidades with nombres: "Kilogramo", "Litro", "Gramo"
- WHEN GET /unidades?orderBy=nombre&order=asc is called
- THEN response lists: [Gramo, Kilogramo, Litro]

#### Scenario: Sort by simbolo descending

- GIVEN unidades with símbolos: "kg", "lt", "g"
- WHEN GET /unidades?orderBy=simbolo&order=desc is called
- THEN response lists by symbol descending (lt, kg, g)

#### Scenario: Invalid orderBy value

- GIVEN an invalid field name `?orderBy=invalid`
- WHEN GET /unidades is called
- THEN handler rejects with 400 { error: "Invalid orderBy field" }

### Requirement: Pagination Input Validation Schema

The system MUST validate pagination parameters with Zod before executing Prisma queries.

#### Scenario: Validate limit is positive integer

- GIVEN `?limit=-5` or `?limit=abc`
- WHEN GET /unidades is called
- THEN Zod validation fails
- AND returns 400 { error: "limit must be a positive integer" }

#### Scenario: Validate offset is non-negative

- GIVEN `?offset=-1`
- WHEN GET /unidades is called
- THEN Zod validation fails
- AND returns 400 { error: "offset must be non-negative" }

#### Scenario: Validate orderBy is enum of allowed fields

- GIVEN `?orderBy=malicious_field`
- WHEN GET /unidades is called
- THEN validator rejects (only "nombre" and "simbolo" allowed)
- AND returns 400

## Success Criteria

- [ ] GET /unidades accepts ?limit, ?offset, ?orderBy, ?order query parameters
- [ ] Pagination parameters are optional and validated with Zod
- [ ] Response always includes `{ items, total, limit, offset, orderBy, order }` envelope
- [ ] Sorting works for nombre and simbolo fields
- [ ] order parameter restricted to "asc" or "desc"
- [ ] Invalid values return HTTP 400 with validation error details
- [ ] Default pagination (no params) returns all results with explicit envelope
- [ ] Offset and limit boundary conditions handled (offset > total returns empty items)
