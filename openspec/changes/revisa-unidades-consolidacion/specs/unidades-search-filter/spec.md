# Unidades Search and Filter Specification

## Purpose

Implement query-based search and filtering on GET /unidades to allow clients to find unidades by text search (nombre/simbolo) without loading the full dataset.

## ADDED Requirements

### Requirement: Text Search via ?search Parameter

The system MUST support `?search={query}` to filter unidades by partial text match on nombre or simbolo (case-insensitive).

#### Scenario: Search for unidad by nombre substring

- GIVEN unidades: "Kilogramo", "Gramo", "Litro"
- WHEN GET /unidades?search=kg is called
- THEN response includes "Kilogramo" (case-insensitive match on nombre)
- AND response includes unidades where search term appears in nombre OR simbolo

#### Scenario: Search returns results from both nombre and simbolo

- GIVEN unidades: (id:1, nombre:"Kilogramo", simbolo:"kg"), (id:2, nombre:"Libra", simbolo:"lb")
- WHEN GET /unidades?search=kg is called
- THEN response includes unidad 1 (matches simbolo "kg")
- AND if another unidad had "kg" in nombre, it also appears

#### Scenario: Search with empty or no match

- GIVEN unidades exist in database
- WHEN GET /unidades?search=zzz is called (no match)
- THEN response returns `{ items: [], total: 0, ... }` (empty but valid)

#### Scenario: Search parameter combined with pagination

- GIVEN 50 matching results for ?search=kg
- WHEN GET /unidades?search=kg&limit=10&offset=0 is called
- THEN response contains first 10 results matching search
- AND total reflects matched count (50), not all unidades

### Requirement: Search Input Validation

The system MUST validate search parameter format and length before executing Prisma query.

#### Scenario: Search query length limit

- GIVEN search query is limited to 100 characters (configurable)
- WHEN GET /unidades?search="x".repeat(150) is called
- THEN Zod validation fails
- AND returns 400 { error: "search query too long" }

#### Scenario: Search parameter is optional

- GIVEN search parameter is omitted
- WHEN GET /unidades?limit=10 is called (no search)
- THEN response returns paginated results without filtering

#### Scenario: Special characters in search are escaped

- GIVEN Prisma uses ILIKE for case-insensitive search
- WHEN GET /unidades?search=% is called (SQL injection attempt)
- THEN handler properly escapes or validates the search term
- AND returns results without SQL errors

### Requirement: Combined Search and Sort

The system MUST apply sorting to search results, respecting both ?search and ?orderBy parameters simultaneously.

#### Scenario: Search with sort by nombre

- GIVEN matches for ?search=k: "Kilogramo" (kg), "Kilo"
- WHEN GET /unidades?search=k&orderBy=nombre&order=asc is called
- THEN results sorted: [Kilo, Kilogramo]

## Success Criteria

- [ ] GET /unidades accepts ?search query parameter
- [ ] Search performs case-insensitive match on nombre and simbolo
- [ ] Search parameter validated with Zod (string, max 100 chars)
- [ ] Search results combined with pagination (?limit, ?offset)
- [ ] Search results can be sorted (?orderBy, ?order)
- [ ] No search results returns empty items array (not error)
- [ ] SQL injection vectors properly escaped or parameterized
- [ ] Response envelope remains consistent `{ items, total, limit, offset, search }`
