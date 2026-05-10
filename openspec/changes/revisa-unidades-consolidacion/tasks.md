# Tasks: Unidades API Consolidation & Hardening WITH UNIQUENESS CONSTRAINTS

## Phase 1: Foundation & Schema Review (Prerequisites)

- [ ] 1.1 Audit Prisma schema: Verify `Unidad` model has no existing duplicates in `nombre` and `simbolo` fields (if duplicates exist, create migration note for data cleanup)
- [ ] 1.2 Plan Prisma unique constraints: Document strategy for adding `@unique` on `nombre` and `simbolo` fields to Unidad model (schema change, not yet applied)
- [ ] 1.3 Review existing tests: Check `src/features/unidades/__tests__/actions.test.ts` for current coverage and test patterns to replicate
- [ ] 1.4 Create validation utilities file: Establish `src/features/unidades/validators.ts` structure with pagination schema, uniqueness check function signature, and error helpers

## Phase 2: Validation Foundation & Uniqueness Detection (Zod + Pre-Prisma Checks)

- [ ] 2.1 Export unidadSchema from `src/features/unidades/schemas.ts` with enhanced error messages (already exists, verify re-export)
- [ ] 2.2 Create unidadUpdateSchema as full replacement schema (all fields required, not optional) in `src/features/unidades/schemas.ts` for PUT operations
- [ ] 2.3 Create paginationSchema in `src/features/unidades/validators.ts`: Zod object with `limit` (positive int, default 50), `offset` (non-negative int, default 0), `orderBy` (enum: "nombre" | "simbolo"), `order` (enum: "asc" | "desc")
- [ ] 2.4 Create search filter schema in `src/features/unidades/validators.ts`: Zod object with `search` (string, max 100 chars, optional)
- [ ] 2.5 Implement uniqueness check function `checkUnidadUniqueness()` in `src/features/unidades/validators.ts` — pre-Prisma function that queries existing unidades by nombre and simbolo, returns conflict details or null
- [ ] 2.6 Create error response builder in `src/features/unidades/validators.ts`: `buildValidationError()` function returning `{ error: string, details?: Array }` structure for 400 responses
- [ ] 2.7 Add conflict error builder in `src/features/unidades/validators.ts`: `buildConflictError()` function for 409 Conflict response when duplicate nombre/simbolo detected

## Phase 3: API Handler Refactoring (Consolidate to Server Actions + Validation + Uniqueness)

- [ ] 3.1 Refactor `GET /unidades` handler: Parse pagination query params, call Prisma with limit/offset/orderBy/order, return paginated envelope
- [ ] 3.2 Add search/filter support to `GET /unidades`: Parse `?search` param, apply Prisma ILIKE filter, combine with pagination
- [ ] 3.3 Refactor `POST /unidades` handler: Validate with unidadSchema, check uniqueness pre-Prisma, return 409 if conflict, else delegate to createUnidadAction(), return 201
- [ ] 3.4 Add PUT `/unidades/{id}` handler: Validate full fields, check uniqueness excluding self, return 409 if conflict, else update via Server Action, return 200
- [ ] 3.5 Refactor `PATCH /unidades/{id}` handler: Validate partial fields, check uniqueness for present fields only, return 409 if conflict, else delegate to updateUnidadAction(), return 200
- [ ] 3.6 Refactor `DELETE /unidades/{id}` handler: Check existence, delegate to deleteUnidadAction(), return 204 No Content
- [ ] 3.7 Add error handler middleware in handlers.ts: Map Zod ValidationError → 400, Prisma NotFoundError → 404, generic errors → 500

## Phase 4: Server Actions Enhancement (Uniqueness Validation + Consistency)

- [ ] 4.1 Update `createUnidadAction()`: Add pre-Prisma uniqueness check, throw `ActionError()` with code "CONFLICT" if duplicate
- [ ] 4.2 Create new `createUnidadWithPUTAction()`: Full replacement action with explicit PUT semantics
- [ ] 4.3 Update `updateUnidadAction()`: Add pre-Prisma uniqueness check excluding current unidadId, throw ActionError if conflict
- [ ] 4.4 Add JSDoc comments to all actions: Document @param types, @returns, @throws cases, uniqueness behavior
- [ ] 4.5 Verify `deleteUnidadAction()` has existence check before Prisma.delete

## Phase 5: Route Setup & HTTP Semantics

- [ ] 5.1 Update `src/app/api/unidades/route.ts`: Export refactored GET and POST handlers
- [ ] 5.2 Update `src/app/api/unidades/[id]/route.ts`: Export GET, PUT (new), PATCH, DELETE handlers
- [ ] 5.3 Verify HTTP status codes: 201 POST, 200 GET/PUT/PATCH, 204 DELETE, 400 validation, 404 not found, 409 conflict, 500 error
- [ ] 5.4 Add response envelope documentation in code comments

## Phase 6: Testing & Uniqueness Scenarios (Red→Green→Refactor)

- [ ] 6.1 Write failing tests for pagination: limit/offset envelope, boundary cases, invalid params return 400
- [ ] 6.2 Write failing tests for search: substring match, case-insensitive, empty results, combined with pagination
- [ ] 6.3 Write failing tests for sorting: nombre asc/desc, simbolo asc/desc, invalid orderBy returns 400
- [ ] 6.4 Write failing tests for POST uniqueness: duplicate nombre/simbolo return 409, unique create returns 201
- [ ] 6.5 Write failing tests for PUT uniqueness: duplicate excluding self returns 409, same record 200, both unique returns 200
- [ ] 6.6 Write failing tests for PATCH uniqueness: duplicate fields return 409, partial non-conflicting update returns 200
- [ ] 6.7 Make tests pass: Implement handlers and actions to pass all pagination, search, sort, and uniqueness tests
- [ ] 6.8 Write HTTP semantics tests: Verify 201 for POST, 204 for DELETE (no body), 400/404/409/500 status codes
- [ ] 6.9 Add integration test: Full CRUD flow with uniqueness constraints verification
- [ ] 6.10 Verify no regressions: Existing `use-unidades` hook continues working

## Phase 7: Database Schema Update (Prisma Unique Constraints)

- [ ] 7.1 Create Prisma migration: Add `@unique` indexes on `nombre` and `simbolo` fields
- [ ] 7.2 Run migration: `pnpm prisma migrate deploy` to apply unique constraints
- [ ] 7.3 Verify migration applied: Confirm unique constraints in database
- [ ] 7.4 Document migration for team: Note pre-migration duplicates must be cleaned

## Phase 8: Documentation & Cleanup

- [ ] 8.1 Add JSDoc block to `src/features/unidades/validators.ts` describing all exports
- [ ] 8.2 Update API documentation: Add comments showing request/response shapes, error formats, conflict scenarios
- [ ] 8.3 Document uniqueness behavior: "Unidad.nombre and .simbolo are globally unique; duplicates return 409"
- [ ] 8.4 Remove any dead code from handlers.ts
- [ ] 8.5 Verify all error messages are consistent (Spanish, professional tone)
- [ ] 8.6 Add migration guide: "If existing duplicates exist, run cleanup before deployment"

## Dependency Graph & Critical Path

**Critical Path**: Phase 2 → Phase 3/4 (parallel) → Phase 5 → Phase 6 → Phase 7 → Phase 8
**Blocking**: Task 2.5 (uniqueness check) blocks 3.3-3.6, 4.1-4.3
**Parallel**: Phase 3 handlers + Phase 4 actions can work simultaneously after Phase 2
**Total Effort**: ~18 hours (47 tasks), realistic timeline 2-3 days with 2 developers
