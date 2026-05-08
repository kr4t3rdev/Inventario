# Change Proposal: Migrate Redux RTK Query APIs to Server Actions (Phase 2)

## Intent
Migrate 5 remaining Redux RTK Query API slices to Next.js Server Actions to reduce client-side bundle size, improve data security, simplify state management, and consolidate all data fetching into a single, type-safe pattern.

## Scope

### Target APIs to Migrate
1. **productosUbicacionApi** - Query only (1 endpoint: getProductosPorUbicacion)
2. **profileApi** - Query + Mutation (2 endpoints: getProfile, updateProfile)
3. **reparacionesApi** - Multiple queries and mutations (8 endpoints total)
4. **produccionApi** - Complex module with 16 endpoints across 3 resource types
5. **reportesFinancierosApi** - Query only (1 endpoint: getRF)

### Total: 28 endpoints to migrate

## Success Criteria
- ✓ All 28 endpoints functional as Server Actions
- ✓ All client components using Server Actions instead of Redux hooks
- ✓ No breaking changes to UI behavior
- ✓ Improved type safety (full end-to-end)
- ✓ Reduced client bundle size by ≥40KB
- ✓ Zero regression in data consistency

## Deliverables
1. Server Actions for all 5 APIs
2. Type-safe Server Action definitions in shared types
3. Updated components consuming new Server Actions
4. Revalidation strategy for ISR/cache invalidation
5. Redux API slices removed and verified for orphaned dependencies
6. Migration tests passing

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Stale data during mutations | Use revalidatePath/revalidateTag after mutations |
| Increased API route complexity | Use utility functions for common patterns |
| Undefined component behavior during migration | Feature flag old → new with fallback |
| Performance regression on large data | Implement pagination in Server Actions |

## Architecture Decision
- **Pattern**: Server Actions + React Query for optimistic updates where needed
- **Error Handling**: Standardized error types thrown from Server Actions, caught in components
- **Cache Strategy**: Use revalidatePath + revalidateTag for cache coherency
- **Type Safety**: Leverage TypeScript strict mode end-to-end

## Rollback Plan
- Git tags at each API completion: `api-{name}-migrated`
- Easy revert to Redux APIs if needed (all files preserved in git history)
- Feature flags to quickly disable Server Actions if performance issues

## Timeline
- Phase 2A: productosUbicacionApi, profileApi (2 simple APIs)
- Phase 2B: reparacionesApi, reportesFinancierosApi (medium complexity)
- Phase 2C: produccionApi (complex, highest endpoint count)
- Phase 2D: Dependency sweep, Redux cleanup, optimization

## Team Review
- Architecture: Server Actions + shared error patterns
- Performance: Bundle size verification before/after
- Testing: All components tested with new Server Actions
