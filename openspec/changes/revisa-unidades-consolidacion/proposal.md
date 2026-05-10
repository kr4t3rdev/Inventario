# Proposal: Unidades API Consolidation & REST Compliance

## Intent

The Unidades feature has **REST API handlers without Zod validation** living alongside **Server Actions with full validation**. This creates:
- **Validation duplication**: Zod schemas exist but REST handlers bypass them
- **REST compliance gaps**: No PUT support, missing pagination, no filter/search
- **Security risk**: Direct request.json() without schema validation in API routes
- **Maintainability burden**: Two separate validation paths diverge

This change consolidates the API layer with validated Server Actions, ensures REST compliance, and eliminates duplication.

## Scope

### In Scope
- Replace API handlers (GET, POST, PATCH, DELETE) to use/delegate to Server Actions
- Add Zod validation to all API routes via shared schemas
- Implement PUT method for full resource replacement (REST compliance)
- Add pagination support to GET /unidades (limit, offset, or cursor-based)
- Add query filters: ?search=, ?orderBy=nombre|simbolo, ?order=asc|desc
- Document API contract with correct HTTP semantics
- Update error responses to use consistent HTTP status codes (400, 404, 500)
- Ensure all tenant context handled correctly (Unidad is global, not tenant-scoped)

### Out of Scope
- UI/component changes (use-unidades hook remains unchanged)
- Database schema migrations (Unidad table structure stays same)
- Rate limiting or auth policy changes (use existing middleware)
- Batch operations or bulk endpoints (future enhancement)
- Internationalization for error messages (stay as-is for now)

## Capabilities

### New Capabilities
- `unidades-api-validation`: Unified Zod validation layer for all REST operations (GET, POST, PUT, PATCH, DELETE)
- `unidades-pagination`: Standardized pagination on list endpoints with configurable limit/offset
- `unidades-search-filter`: Query-based filtering and sorting on Unidades list

### Modified Capabilities
- `unidades-crud`: Current CRUD operations now use validated Server Actions consistently, with added PUT support and proper HTTP semantics

## Approach

1. **Validation Layer** (1 day)
   - Export Zod schemas from `actions.ts` → make them importable in handlers
   - Create unified `validators.ts` with pagination input schema
   - Update handlers to parse input with Zod before Prisma calls

2. **REST Consolidation** (1 day)
   - Refactor POST/PATCH/DELETE handlers to use existing Server Actions (import + call)
   - Add PUT handler (full replace) alongside PATCH
   - Add pagination query parsing (limit, offset, orderBy, order)
   - Standardize error responses (400 for validation, 404 for not found, 500 for server errors)

3. **Testing & Verification** (0.5 day)
   - Update existing unit tests to validate Zod integration
   - Add E2E tests for pagination, filtering, and new PUT method
   - Verify no breaking changes to existing consumers (UI layer)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/unidades/api/handlers.ts` | Modified | Add Zod validation, delegate to Server Actions, implement PUT, add pagination |
| `src/features/unidades/schemas.ts` | Modified | Export pagination schema, rename exports for re-export in handlers |
| `src/app/api/unidades/route.ts` | Modified | POST now validates with Zod, GET adds pagination/filter support |
| `src/app/api/unidades/[id]/route.ts` | Modified | Add PUT method, all methods use validated input |
| `src/features/unidades/__tests__/actions.test.ts` | Modified | Add tests for API handler validation layer |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking changes to API consumers (if any external calls exist) | Med | Verify all consumers in codebase use Server Actions (they do), keep backward-compatible responses |
| Tenant isolation regression (Unidad is global) | Low | Verify no accidental tenantId filtering added; Unidad schema has no tenant context |
| Over-validation reducing performance on GET list | Low | Pagination validation is cheap (string parsing); test with realistic data volume |
| Zod import errors in API routes | Low | Both files in same feature module; straightforward ES import |

## Rollback Plan

1. **If validation breaks existing API consumers**: Revert handlers.ts to skip validation, keep Server Actions intact (they're not exposed)
2. **If pagination breaks UI pagination logic**: Remove limit/offset params, return full list (backward compatible)
3. **If PUT causes issues**: Remove PUT method, keep PATCH-only (existing behavior)
4. **Git rollback**: `git revert {commit-hash}` — no database changes, pure code revert

## Dependencies

- Zod (already in project)
- Prisma (already in project)
- Server Actions pattern (already established in feature)
- Next.js request/response handling (already in use)

## Success Criteria

- [ ] All API handlers validate input with Zod before Prisma calls
- [ ] GET /unidades supports pagination with limit, offset, orderBy, order params
- [ ] GET /unidades supports search filter via ?search=
- [ ] PUT method implemented and tested alongside PATCH
- [ ] No breaking changes: existing UI consumers (use-unidades hook) continue to work
- [ ] HTTP status codes align with REST standards (400, 404, 500)
- [ ] All error responses include consistent error message format
- [ ] Test coverage ≥ 80% for new/modified handlers
- [ ] No tenant isolation regressions (Unidad remains global)
